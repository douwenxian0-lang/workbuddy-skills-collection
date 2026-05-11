/**
 * HTTP transport — sends JSON-RPC 2.0 requests to the Supervisor.
 */

import type { JsonRpcRequest, JsonRpcResponse } from '@wanman/core';
import { createRpcRequest } from '@wanman/core';

const BASE_URL = process.env['WANMAN_URL'] || 'http://localhost:3120';

export async function rpcCall(method: string, params?: Record<string, unknown>): Promise<JsonRpcResponse> {
  const req = createRpcRequest(method, params);
  const resp = await fetch(`${BASE_URL}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }

  return resp.json() as Promise<JsonRpcResponse>;
}

export async function healthCheck(): Promise<unknown> {
  const resp = await fetch(`${BASE_URL}/health`);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }
  return resp.json();
}
