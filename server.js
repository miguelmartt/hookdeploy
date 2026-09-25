const { createApp } = require('./src/app');
const { loadConfig } = require('./src/config');
const { createLogger } = require('./src/logger');

let config;
try {
  config = loadConfig(process.env);
} catch (err) {
  console.error(`CONFIG ERROR: ${err.message}`);
  process.exit(1);
}

const logger = createLogger(config.logLevel);
const server = createApp(config, { logger });

if (require.main === module) {
  server.listen(config.port, config.host, () => {
    console.log(`Servidor activo en http://localhost:${config.port}`);
    logger.info('servidor activo', { port: config.port, host: config.host, dryRun: config.dryRun, webhookEnabled: config.webhookEnabled });
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const timer = setTimeout(() => {
      logger.warn('shutdown forzado tras 30s');
      process.exit(1);
    }, 30000);
    timer.unref();
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = server;
