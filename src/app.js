const http = require('node:http');
const { getBuildInfo } = require('./buildinfo');

let pkgVersion = '0.1.0';
try {
  pkgVersion = require('../package.json').version || pkgVersion;
} catch (_) {
  // keep default
}

function sendJson(res, statusCode, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function buildEnvFromConfig(config) {
  const build = (config && config.build) || {};
  return {
    GIT_SHA: build.sha || process.env.GIT_SHA,
    GIT_REF: build.ref || process.env.GIT_REF,
    BUILD_DATE: build.buildDate || process.env.BUILD_DATE,
    RUN_NUMBER: build.runNumber || process.env.RUN_NUMBER,
    RUN_URL: build.runUrl || process.env.RUN_URL
  };
}

function createApp(config, deps = {}) {
  const now = deps.now || (() => new Date().toISOString());

  const server = http.createServer((req, res) => {
    // Never expose X-Powered-By (native http does not send it by default)
    res.removeHeader('X-Powered-By');

    let pathname;
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      pathname = url.pathname;
    } catch (_) {
      return sendJson(res, 400, { error: 'bad_request' });
    }

    const method = (req.method || 'GET').toUpperCase();
    const route = `${method} ${pathname}`;

    switch (route) {
      case 'GET /': {
        return sendJson(res, 200, {
          estado: 'OK',
          mensaje: '¡Servidor web desplegado con éxito en el contenedor!',
          modulo: 'DAW - Módulo 0614',
          timestamp: now(),
          servicio: 'hookdeploy',
          version: pkgVersion
        });
      }
      case 'GET /health': {
        return sendJson(res, 200, {
          status: 'ok',
          uptime: process.uptime(),
          dryRun: config.dryRun !== false,
          webhookEnabled: Boolean(config.webhookSecret)
        });
      }
      case 'GET /version': {
        return sendJson(res, 200, getBuildInfo(buildEnvFromConfig(config), { name: 'hookdeploy', version: pkgVersion }));
      }
      default: {
        // Known paths but wrong method -> 405 with Allow
        if (pathname === '/' || pathname === '/health' || pathname === '/version') {
          return sendJson(res, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
        }
        return sendJson(res, 404, { error: 'not_found' });
      }
    }
  });

  return server;
}

module.exports = { createApp };
