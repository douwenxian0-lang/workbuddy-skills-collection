'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Extract a .tgz buffer into destDir using pure JS tar parsing.
 * Handles GNU long-name extensions (typeFlag 'L') and USTAR prefix.
 *
 * @param {Buffer} tgzBuffer  — gzipped tar data
 * @param {string} destDir    — target directory
 * @param {number} [stripComponents=1] — path components to strip (e.g. "package/")
 * @returns {number} number of files written
 */
function extractTgz(tgzBuffer, destDir, stripComponents = 1) {
  const tarBuffer = zlib.gunzipSync(tgzBuffer);
  let offset = 0;
  let fileCount = 0;

  while (offset < tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((b) => b === 0)) break;

    let name = header.subarray(0, 100).toString('utf8').replace(/\0/g, '');
    const sizeOctal = header
      .subarray(124, 136)
      .toString('utf8')
      .replace(/\0/g, '')
      .trim();
    const size = parseInt(sizeOctal, 8) || 0;
    const typeFlag = String.fromCharCode(header[156]);

    // Handle GNU long name extension
    if (typeFlag === 'L') {
      name = tarBuffer
        .subarray(offset, offset + size)
        .toString('utf8')
        .replace(/\0/g, '');
      offset += Math.ceil(size / 512) * 512;

      const nextHeader = tarBuffer.subarray(offset, offset + 512);
      offset += 512;
      const nextSize =
        parseInt(
          nextHeader
            .subarray(124, 136)
            .toString('utf8')
            .replace(/\0/g, '')
            .trim(),
          8,
        ) || 0;
      const nextType = String.fromCharCode(nextHeader[156]);

      const parts = name.split('/').slice(stripComponents);
      const relPath = parts.join('/');
      if (relPath) {
        const fullPath = path.join(destDir, relPath);
        const resolvedDest = path.resolve(destDir);
        const resolvedFull = path.resolve(fullPath);
        if (!resolvedFull.startsWith(resolvedDest + path.sep) && resolvedFull !== resolvedDest) {
          // Skip entry that would escape destDir
          offset += Math.ceil(nextSize / 512) * 512;
          continue;
        }
        if (nextType === '5' || relPath.endsWith('/')) {
          fs.mkdirSync(fullPath, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(
            fullPath,
            tarBuffer.subarray(offset, offset + nextSize),
          );
          fileCount++;
        }
      }
      offset += Math.ceil(nextSize / 512) * 512;
      continue;
    }

    // USTAR prefix
    const prefix = header
      .subarray(345, 500)
      .toString('utf8')
      .replace(/\0/g, '');
    const fullName = prefix ? prefix + '/' + name : name;
    const parts = fullName.split('/').slice(stripComponents);
    const relPath = parts.join('/');

    if (!relPath || relPath === '.') {
      offset += Math.ceil(size / 512) * 512;
      continue;
    }

    const fullPath = path.join(destDir, relPath);
    const resolvedDest = path.resolve(destDir);
    const resolvedFull = path.resolve(fullPath);
    if (!resolvedFull.startsWith(resolvedDest + path.sep) && resolvedFull !== resolvedDest) {
      // Skip entry that would escape destDir
      offset += Math.ceil(size / 512) * 512;
      continue;
    }
    if (typeFlag === '5' || name.endsWith('/')) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else if (typeFlag === '0' || typeFlag === '' || typeFlag === '\0') {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, tarBuffer.subarray(offset, offset + size));
      fileCount++;
    }
    offset += Math.ceil(size / 512) * 512;
  }

  return fileCount;
}

module.exports = { extractTgz };
