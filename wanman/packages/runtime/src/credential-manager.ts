/**
 * OAuth credential manager for Claude Code CLI.
 *
 * Handles two auth modes:
 * - API Key: all methods are no-ops
 * - OAuth: manages token refresh lifecycle
 *
 * Lifecycle:
 *   bootstrap() → startRefreshLoop() → ensureFresh() / syncFromFile() → shutdown()
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createLogger } from './logger.js';

const log = createLogger('credential-manager');

// --- Constants ---

const OAUTH_CLIENT_ID = process.env['ANTHROPIC_OAUTH_CLIENT_ID'] || '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const OAUTH_TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token';

/** Periodic check interval (5 minutes) */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** Periodic refresh threshold — refresh when < 2h until expiry */
const PERIODIC_THRESHOLD_MS = 2 * 60 * 60 * 1000;
/** Pre-spawn refresh threshold — refresh when < 1h until expiry */
const PRE_SPAWN_THRESHOLD_MS = 60 * 60 * 1000;

const VAULT_PATH = '/data/.credentials-vault.json';

export type AuthMode = 'api-key' | 'oauth' | 'none';

interface OAuthCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export class CredentialManager {
  private authMode: AuthMode = 'none';
  private credentials: OAuthCredentials | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private credentialsFilePath: string;
  private vaultPath: string;

  constructor(options?: { credentialsFilePath?: string; vaultPath?: string }) {
    const home = process.env['HOME'] || '/root';
    this.credentialsFilePath = options?.credentialsFilePath
      || path.join(home, '.claude', '.credentials.json');
    this.vaultPath = options?.vaultPath || VAULT_PATH;
  }

  /** Detect auth mode from environment variables. */
  detectAuthMode(): AuthMode {
    if (process.env['ANTHROPIC_API_KEY']) {
      this.authMode = 'api-key';
    } else if (process.env['CLAUDE_CREDENTIALS']) {
      this.authMode = 'oauth';
    } else {
      this.authMode = 'none';
    }
    return this.authMode;
  }

  /** Initialize credentials from vault or env, write to file system. */
  async bootstrap(): Promise<void> {
    if (this.authMode !== 'oauth') return;

    // Priority 1: restore from vault
    if (fs.existsSync(this.vaultPath)) {
      try {
        const raw = fs.readFileSync(this.vaultPath, 'utf-8');
        this.credentials = JSON.parse(raw) as OAuthCredentials;
        log.info('credentials restored from vault');
      } catch (err) {
        log.warn('failed to read vault, falling back to env', {
          error: err instanceof Error ? err.message : String(err),
        });
        this.credentials = null;
      }
    }

    // Priority 2: fall back to CLAUDE_CREDENTIALS env var
    if (!this.credentials) {
      const envCreds = process.env['CLAUDE_CREDENTIALS'];
      if (!envCreds) {
        log.error('CLAUDE_CREDENTIALS env var is empty');
        return;
      }
      try {
        this.credentials = JSON.parse(envCreds) as OAuthCredentials;
        log.info('credentials loaded from env');
      } catch (err) {
        log.error('failed to parse CLAUDE_CREDENTIALS', {
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    // Write credentials to file system and vault
    this.writeCredentialsFile();
    this.saveToVault();

    // If token is close to expiry, refresh immediately
    if (this.isExpiringSoon(PRE_SPAWN_THRESHOLD_MS)) {
      log.info('token expiring soon, refreshing immediately');
      await this.refreshOAuthToken();
    }
  }

  /** Start the periodic refresh loop (every 5 minutes). */
  startRefreshLoop(): void {
    if (this.authMode !== 'oauth') return;
    if (this.refreshTimer) return;

    this.refreshTimer = setInterval(async () => {
      if (this.isExpiringSoon(PERIODIC_THRESHOLD_MS)) {
        log.info('periodic refresh triggered');
        await this.refreshOAuthToken();
      }
    }, REFRESH_INTERVAL_MS);

    // Don't keep the process alive just for this timer
    if (this.refreshTimer && typeof this.refreshTimer === 'object' && 'unref' in this.refreshTimer) {
      this.refreshTimer.unref();
    }

    log.info('refresh loop started', { intervalMs: REFRESH_INTERVAL_MS });
  }

  /** Stop the periodic refresh loop. */
  stopRefreshLoop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      log.info('refresh loop stopped');
    }
  }

  /** Ensure credentials are fresh before spawning an agent. */
  async ensureFresh(): Promise<void> {
    if (this.authMode !== 'oauth') return;

    if (this.isExpiringSoon(PRE_SPAWN_THRESHOLD_MS)) {
      log.info('pre-spawn refresh triggered');
      await this.refreshOAuthToken();
    }
  }

  /** Sync credentials from file after agent exit (CLI may have refreshed). */
  async syncFromFile(): Promise<void> {
    if (this.authMode !== 'oauth') return;

    try {
      if (!fs.existsSync(this.credentialsFilePath)) return;

      const raw = fs.readFileSync(this.credentialsFilePath, 'utf-8');
      const fileCreds = JSON.parse(raw) as OAuthCredentials;

      const fileExpiresAt = fileCreds.claudeAiOauth?.expiresAt ?? 0;
      const currentExpiresAt = this.credentials?.claudeAiOauth?.expiresAt ?? 0;

      if (fileExpiresAt > currentExpiresAt) {
        log.info('CLI refreshed token detected, syncing', {
          oldExpiresAt: currentExpiresAt,
          newExpiresAt: fileExpiresAt,
        });
        this.credentials = fileCreds;
        this.saveToVault();
      }
    } catch (err) {
      log.warn('failed to sync credentials from file', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Save credentials to vault and stop refresh loop. */
  async shutdown(): Promise<void> {
    this.stopRefreshLoop();

    if (this.authMode === 'oauth' && this.credentials) {
      this.saveToVault();
      log.info('credentials saved to vault on shutdown');
    }
  }

  // --- Private methods ---

  private isExpiringSoon(thresholdMs: number): boolean {
    if (!this.credentials) return false;
    const expiresAt = this.credentials.claudeAiOauth?.expiresAt ?? 0;
    return (expiresAt - Date.now()) < thresholdMs;
  }

  private async refreshOAuthToken(): Promise<void> {
    if (!this.credentials) return;

    const refreshToken = this.credentials.claudeAiOauth.refreshToken;
    if (!refreshToken) {
      log.error('no refresh token available');
      return;
    }

    try {
      const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: OAUTH_CLIENT_ID,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable>');
        log.error('oauth refresh failed', {
          status: response.status,
          body: body.slice(0, 200),
        });
        return;
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      const newExpiresAt = Date.now() + data.expires_in * 1000;
      const currentExpiresAt = this.credentials.claudeAiOauth.expiresAt;

      // Only update if the new token has a later expiry (prevent race conditions)
      if (newExpiresAt <= currentExpiresAt) {
        log.info('skipping refresh — current token is newer', {
          currentExpiresAt,
          newExpiresAt,
        });
        return;
      }

      this.credentials = {
        claudeAiOauth: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: newExpiresAt,
        },
      };

      this.writeCredentialsFile();
      this.saveToVault();

      log.info('oauth token refreshed', {
        expiresAt: newExpiresAt,
        expiresIn: data.expires_in,
      });
    } catch (err) {
      log.error('oauth refresh error', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't throw — never block agent execution
    }
  }

  private writeCredentialsFile(): void {
    if (!this.credentials) return;

    try {
      const dir = path.dirname(this.credentialsFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.credentialsFilePath,
        JSON.stringify(this.credentials, null, 2),
        { mode: 0o600 },
      );
      // Fix ownership so agent user can read credentials
      this.chownForAgent(this.credentialsFilePath);
    } catch (err) {
      log.error('failed to write credentials file', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private saveToVault(): void {
    if (!this.credentials) return;

    try {
      const dir = path.dirname(this.vaultPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.vaultPath,
        JSON.stringify(this.credentials, null, 2),
        { mode: 0o600 },
      );
      this.chownForAgent(this.vaultPath);
    } catch (err) {
      log.warn('failed to save to vault', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Fix file ownership for agent user when running as root. */
  private chownForAgent(filePath: string): void {
    const agentUser = process.env['WANMAN_AGENT_USER'];
    if (agentUser && process.getuid?.() === 0) {
      try {
        execSync(`chown ${agentUser}:${agentUser} ${filePath}`, { stdio: 'pipe' });
      } catch { /* best effort */ }
    }
  }
}
