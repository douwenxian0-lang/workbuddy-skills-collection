'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { extractTgz } = require('../../src/lib/tar.cjs');

/**
 * Build a minimal tar entry (header + data blocks).
 * Checksum is computed properly so extractTgz can parse it.
 */
function createTarEntry(name, content, typeFlag = '0') {
  const header = Buffer.alloc(512);
  // name field (0–99)
  header.write(name, 0, Math.min(name.length, 100));
  // mode (100–107)
  header.write('0000644\0', 100);
  // uid (108–115)
  header.write('0000000\0', 108);
  // gid (116–123)
  header.write('0000000\0', 116);
  // size (124–135) — directories have size 0
  const sz = typeFlag === '5' ? 0 : content.length;
  header.write(sz.toString(8).padStart(11, '0') + '\0', 124);
  // mtime (136–147)
  header.write('00000000000\0', 136);
  // type flag (156)
  header[156] = typeFlag.charCodeAt(0);
  // magic "ustar\0" (257–262) + version "00" (263–264)
  header.write('ustar\0', 257);
  header.write('00', 263);

  // Checksum: fill checksum field (148–155) with spaces, then sum all bytes
  header.fill(0x20, 148, 156);
  let cksum = 0;
  for (let i = 0; i < 512; i++) cksum += header[i];
  header.write(cksum.toString(8).padStart(6, '0') + '\0 ', 148);

  if (sz === 0) return header;

  const dataBlocks = Buffer.alloc(Math.ceil(sz / 512) * 512);
  Buffer.from(content).copy(dataBlocks);
  return Buffer.concat([header, dataBlocks]);
}

/** Two zero blocks mark end-of-archive */
function tarEnd() {
  return Buffer.alloc(1024);
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tar-test-'));
}

describe('extractTgz()', () => {
  it('extracts a single file with stripComponents=1', () => {
    const tar = Buffer.concat([
      createTarEntry('package/', '', '5'),
      createTarEntry('package/hello.txt', 'hello world'),
      tarEnd(),
    ]);
    const tgz = zlib.gzipSync(tar);
    const dest = makeTmpDir();
    try {
      const count = extractTgz(tgz, dest, 1);
      assert.equal(count, 1);
      const content = fs.readFileSync(path.join(dest, 'hello.txt'), 'utf8');
      assert.equal(content, 'hello world');
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('extracts nested directories', () => {
    const tar = Buffer.concat([
      createTarEntry('package/', '', '5'),
      createTarEntry('package/sub/', '', '5'),
      createTarEntry('package/sub/deep.txt', 'nested content'),
      tarEnd(),
    ]);
    const tgz = zlib.gzipSync(tar);
    const dest = makeTmpDir();
    try {
      const count = extractTgz(tgz, dest, 1);
      assert.equal(count, 1);
      assert.ok(fs.existsSync(path.join(dest, 'sub')));
      const content = fs.readFileSync(path.join(dest, 'sub', 'deep.txt'), 'utf8');
      assert.equal(content, 'nested content');
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('respects stripComponents=0', () => {
    const tar = Buffer.concat([
      createTarEntry('package/', '', '5'),
      createTarEntry('package/a.txt', 'aaa'),
      tarEnd(),
    ]);
    const tgz = zlib.gzipSync(tar);
    const dest = makeTmpDir();
    try {
      const count = extractTgz(tgz, dest, 0);
      assert.equal(count, 1);
      assert.ok(fs.existsSync(path.join(dest, 'package', 'a.txt')));
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('extracts multiple files and returns correct count', () => {
    const tar = Buffer.concat([
      createTarEntry('pkg/', '', '5'),
      createTarEntry('pkg/one.txt', '1'),
      createTarEntry('pkg/two.txt', '22'),
      createTarEntry('pkg/three.txt', '333'),
      tarEnd(),
    ]);
    const tgz = zlib.gzipSync(tar);
    const dest = makeTmpDir();
    try {
      const count = extractTgz(tgz, dest, 1);
      assert.equal(count, 3);
      assert.equal(fs.readFileSync(path.join(dest, 'one.txt'), 'utf8'), '1');
      assert.equal(fs.readFileSync(path.join(dest, 'two.txt'), 'utf8'), '22');
      assert.equal(fs.readFileSync(path.join(dest, 'three.txt'), 'utf8'), '333');
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('creates directory entries', () => {
    const tar = Buffer.concat([
      createTarEntry('package/', '', '5'),
      createTarEntry('package/lib/', '', '5'),
      createTarEntry('package/lib/sub/', '', '5'),
      tarEnd(),
    ]);
    const tgz = zlib.gzipSync(tar);
    const dest = makeTmpDir();
    try {
      const count = extractTgz(tgz, dest, 1);
      assert.equal(count, 0); // no files, only dirs
      assert.ok(fs.statSync(path.join(dest, 'lib')).isDirectory());
      assert.ok(fs.statSync(path.join(dest, 'lib', 'sub')).isDirectory());
    } finally {
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });
});
