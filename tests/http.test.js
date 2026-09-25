const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');

function baseConfig(overrides = {}) {
  const silent = { warn: () => {}, info: () => {}, debug: () => {}, error: () => {} };
  const config = loadConfig({ ...process.env, CONFIG_PATH: './no-existe.json', ...overrides }, { logger: silent });
  return config;
}

describe('http v0.1.0', () => {
  it('GET / devuelve 200 con los 4 campos de la ficha', async () => {
    const config = baseConfig();
    const server = createApp(config);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /application\/json/);
      const json = await res.json();
      assert.equal(json.estado, 'OK');
      assert.equal(json.mensaje, '¡Servidor web desplegado con éxito en el contenedor!');
      assert.equal(json.modulo, 'DAW - Módulo 0614');
      assert.ok(json.timestamp);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /health y /version devuelven 200; ruta desconocida 404; PUT / 405', async () => {
    const config = baseConfig();
    const server = createApp(config);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(health.status, 200);

      const version = await fetch(`http://127.0.0.1:${port}/version`);
      assert.equal(version.status, 200);
      const vjson = await version.json();
      assert.equal(vjson.name, 'hookdeploy');
      assert.ok(vjson.version);
      assert.ok(vjson.node);

      const missing = await fetch(`http://127.0.0.1:${port}/no-existe`);
      assert.equal(missing.status, 404);

      const put = await fetch(`http://127.0.0.1:${port}/`, { method: 'PUT' });
      assert.equal(put.status, 405);
      assert.ok(put.headers.get('allow'));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
