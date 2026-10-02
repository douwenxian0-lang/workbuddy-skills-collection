'use strict';

const net = require('net');
const { CDP_ALL_PORTS } = require('./paths.cjs');

/**
 * Test whether a TCP port is free on 127.0.0.1.
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find the first available CDP port from the predefined list.
 * @returns {Promise<{ available: boolean, port: number|null }>}
 */
async function findAvailablePort() {
  for (const port of CDP_ALL_PORTS) {
    if (await isPortFree(port)) return { available: true, port };
  }
  return { available: false, port: null };
}

module.exports = { findAvailablePort, isPortFree };
