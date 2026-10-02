const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { BROWSER_DEFS, detectBrowser, detectAllBrowsers } = require('../../src/lib/detect-browsers.cjs');

describe('BROWSER_DEFS', () => {
  it('contains chrome, edge, qqbrowser', () => {
    assert.ok(BROWSER_DEFS.chrome);
    assert.ok(BROWSER_DEFS.edge);
    assert.ok(BROWSER_DEFS.qqbrowser);
    assert.equal(Object.keys(BROWSER_DEFS).length, 3);
  });

  it('each def has required fields', () => {
    for (const [name, def] of Object.entries(BROWSER_DEFS)) {
      assert.ok(def.display_name, `${name} missing display_name`);
      assert.equal(typeof def.cdp_default_port, 'number', `${name} missing cdp_default_port`);
      assert.ok(def.paths, `${name} missing paths`);
      assert.ok(def.user_data, `${name} missing user_data`);
      assert.ok(Array.isArray(def.registry_keys), `${name} missing registry_keys`);
      assert.ok(Array.isArray(def.linux_commands), `${name} missing linux_commands`);
    }
  });
});

describe('detectBrowser()', () => {
  it('returns correct structure for known browser', () => {
    const result = detectBrowser('chrome');
    assert.equal(result.name, 'chrome');
    assert.equal(result.display_name, 'Google Chrome');
    assert.equal(typeof result.installed, 'boolean');
    assert.equal(typeof result.version, 'string');
    assert.equal(typeof result.executable_path, 'string');
    assert.equal(typeof result.user_data_path, 'string');
    assert.equal(typeof result.user_data_exists, 'boolean');
    assert.equal(typeof result.cdp_default_port, 'number');
    assert.ok(Array.isArray(result.notes));
  });

  it('returns correct structure for edge', () => {
    const result = detectBrowser('edge');
    assert.equal(result.name, 'edge');
    assert.equal(result.display_name, 'Microsoft Edge');
    assert.equal(result.cdp_default_port, 9334);
  });

  it('returns correct structure for qqbrowser', () => {
    const result = detectBrowser('qqbrowser');
    assert.equal(result.name, 'qqbrowser');
    assert.equal(result.display_name, 'QQ 浏览器');
    assert.equal(result.cdp_default_port, 9333);
  });

  it('handles unknown browser gracefully', () => {
    const result = detectBrowser('firefox');
    assert.equal(result.name, 'firefox');
    assert.equal(result.installed, false);
    assert.equal(result.cdp_default_port, 0);
    assert.ok(result.notes.some((n) => n.includes('Unknown browser')));
  });

  it('includes resolution source in notes when installed', () => {
    // Test with a browser that is likely installed on this platform
    const result = detectBrowser('chrome');
    if (result.installed) {
      assert.ok(result.notes.some((n) => n.startsWith('Resolved via ')),
        'installed browser should have "Resolved via" in notes');
      const resolvedNote = result.notes.find((n) => n.startsWith('Resolved via '));
      const source = resolvedNote.replace('Resolved via ', '');
      assert.ok(['registry', 'file_path', 'linux_command'].includes(source),
        `unexpected resolution source: ${source}`);
    }
  });

  it('includes "Executable not found" in notes for known but uninstalled browser', () => {
    // Use a known browser that might not be installed; check notes content
    const result = detectBrowser('qqbrowser');
    if (!result.installed) {
      assert.ok(result.notes.some((n) => n === 'Executable not found'));
    }
    // For unknown browsers, notes contain "Unknown browser" instead
    const unknown = detectBrowser('firefox');
    assert.ok(unknown.notes.some((n) => n.includes('Unknown browser')));
  });
});

describe('detectAllBrowsers()', () => {
  it('returns browsers array with platform and arch', () => {
    const result = detectAllBrowsers();
    assert.ok(Array.isArray(result.browsers));
    assert.equal(result.browsers.length, 3);
    assert.equal(typeof result.platform, 'string');
    assert.equal(typeof result.arch, 'string');
  });

  it('browsers array contains chrome, edge, qqbrowser', () => {
    const result = detectAllBrowsers();
    const names = result.browsers.map((b) => b.name);
    assert.ok(names.includes('chrome'));
    assert.ok(names.includes('edge'));
    assert.ok(names.includes('qqbrowser'));
  });
});
