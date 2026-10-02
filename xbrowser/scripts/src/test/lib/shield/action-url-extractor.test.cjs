const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractUrls, URL_BEARING_VERBS } = require('../../../src/lib/shield/action-url-extractor.cjs');

describe('extractUrls', () => {
  it('extracts URL from open command', () => {
    assert.deepEqual(extractUrls(['open', 'https://baidu.com']), ['https://baidu.com']);
  });
  it('extracts URL from goto command', () => {
    assert.deepEqual(extractUrls(['goto', 'http://example.com']), ['http://example.com']);
  });
  it('extracts URL from navigate command', () => {
    assert.deepEqual(extractUrls(['navigate', 'http://x']), ['http://x']);
  });
  it('returns [] for non-URL-bearing commands', () => {
    assert.deepEqual(extractUrls(['click', '@e3']), []);
    assert.deepEqual(extractUrls(['snapshot', '-i']), []);
    assert.deepEqual(extractUrls(['fill', '@e3', 'hello']), []);
    assert.deepEqual(extractUrls(['get', 'url']), []);
  });
  it('returns [] when args empty', () => {
    assert.deepEqual(extractUrls([]), []);
    assert.deepEqual(extractUrls(['open']), []);
  });
  it('handles unknown verbs as non-URL', () => {
    assert.deepEqual(extractUrls(['weird', 'http://x']), []);
  });
});

describe('URL_BEARING_VERBS', () => {
  it('contains expected verbs', () => {
    assert.ok(URL_BEARING_VERBS.has('open'));
    assert.ok(URL_BEARING_VERBS.has('goto'));
    assert.ok(URL_BEARING_VERBS.has('navigate'));
  });
});
