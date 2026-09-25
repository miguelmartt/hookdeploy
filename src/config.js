const fs = require('node:fs');
const path = require('node:path');

function parsePort(value, def) {
  if (value === undefined || value === '') return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error('CONFIG: PORT debe ser un entero entre 1 y 65535');
  }
  return n;
}

function parseBool(value, def) {
  if (value === undefined || value === '') return def;
  const v = String(value).toLowerCase().trim();
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  return def;
}

function parseIntPositive(value, def, name) {
  if (value === undefined || value === '') return def;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`CONFIG: ${name} debe ser un entero positivo`);
  }
  return n;
}

function validateApp(app, index) {
  const prefix = `CONFIG: apps[${index}]`;
  if (typeof app !== 'object' || app === null || Array.isArray(app)) {
    throw new Error(`${prefix} debe ser un objeto`);
  }
  const allowed = new Set(['name', 'repo', 'branch', 'workflow', 'composeFile', 'service']);
  for (const key of Object.keys(app)) {
    if (!allowed.has(key)) {
      throw new Error(`${prefix}.${key} es una clave desconocida`);
    }
  }
  if (typeof app.name !== 'string' || !/^[a-z0-9-]{1,50}$/.test(app.name)) {
    throw new Error(`${prefix}.name debe coincidir con ^[a-z0-9-]{1,50}$`);
  }
  if (typeof app.repo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(app.repo)) {
    throw new Error(`${prefix}.repo debe tener formato owner/repo`);
  }
  if (typeof app.branch !== 'string' || app.branch.length === 0) {
    throw new Error(`${prefix}.branch es obligatorio`);
  }
  if (app.workflow !== undefined && typeof app.workflow !== 'string') {
    throw new Error(`${prefix}.workflow debe ser un string`);
  }
  if (typeof app.composeFile !== 'string' || !path.isAbsolute(app.composeFile)) {
    throw new Error(`${prefix}.composeFile debe ser una ruta absoluta`);
  }
  if (!/\.ya?ml$/.test(app.composeFile)) {
    throw new Error(`${prefix}.composeFile debe terminar en .yml o .yaml`);
  }
  if (app.composeFile.includes('..')) {
    throw new Error(`${prefix}.composeFile no puede contener ..`);
  }
  if (typeof app.service !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(app.service)) {
    throw new Error(`${prefix}.service no es válido`);
  }
}

function loadConfig(env = process.env, opts = {}) {
  const logger = opts.logger || null;
  const port = parsePort(env.PORT, 3000);
  const host = env.HOST || '0.0.0.0';

  const webhookSecret = env.WEBHOOK_SECRET || '';
  if (webhookSecret !== '' && webhookSecret.length < 32) {
    throw new Error('CONFIG: WEBHOOK_SECRET debe tener al menos 32 caracteres');
  }

  const configPath = env.CONFIG_PATH || './hookdeploy.config.json';
  const dryRun = parseBool(env.DRY_RUN, true);
  const deployTimeoutMs = parseIntPositive(env.DEPLOY_TIMEOUT_MS, 300000, 'DEPLOY_TIMEOUT_MS');
  const maxBodyBytes = parseIntPositive(env.MAX_BODY_BYTES, 1048576, 'MAX_BODY_BYTES');
  const historySize = parseIntPositive(env.HISTORY_SIZE, 20, 'HISTORY_SIZE');
  const statusToken = env.STATUS_TOKEN || '';
  const logLevel = env.LOG_LEVEL || 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new Error('CONFIG: LOG_LEVEL debe ser debug, info, warn o error');
  }

  let apps = [];
  const resolvedPath = path.isAbsolute(configPath)
    ? configPath
    : path.resolve(process.cwd(), configPath);
  if (fs.existsSync(resolvedPath)) {
    let raw;
    try {
      raw = fs.readFileSync(resolvedPath, 'utf8');
    } catch (err) {
      throw new Error(`CONFIG: no se puede leer ${configPath}: ${err.message}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`CONFIG: ${configPath} no es un JSON válido: ${err.message}`);
    }
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.apps)) {
      throw new Error('CONFIG: el fichero debe contener { "apps": [...] }');
    }
    parsed.apps.forEach(validateApp);
    const names = new Set();
    const repos = new Set();
    for (const app of parsed.apps) {
      if (names.has(app.name)) throw new Error(`CONFIG: app name duplicado: ${app.name}`);
      if (repos.has(app.repo)) throw new Error(`CONFIG: app repo duplicado: ${app.repo}`);
      names.add(app.name);
      repos.add(app.repo);
    }
    apps = parsed.apps;
  } else {
    const msg = `config file not found: ${configPath}, allowlist vacia`;
    if (logger && typeof logger.warn === 'function') {
      logger.warn(msg);
    } else {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg }));
    }
  }

  const config = {
    port,
    host,
    webhookSecret,
    webhookEnabled: webhookSecret !== '',
    configPath: resolvedPath,
    apps,
    dryRun,
    deployTimeoutMs,
    maxBodyBytes,
    historySize,
    statusToken,
    logLevel,
    build: {
      sha: env.GIT_SHA || 'unknown',
      ref: env.GIT_REF || 'unknown',
      buildDate: env.BUILD_DATE || 'unknown',
      runNumber: env.RUN_NUMBER || 'unknown',
      runUrl: env.RUN_URL || 'unknown'
    }
  };

  return deepFreeze(config);
}

function deepFreeze(obj) {
  if (obj !== null && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      deepFreeze(obj[key]);
    }
  }
  return obj;
}

module.exports = { loadConfig };
