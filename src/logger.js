function createLogger(level = 'info') {
  const order = { debug: 0, info: 1, warn: 2, error: 3 };
  const current = order[level] ?? order.info;

  function log(lvl, msg, extra = {}) {
    if ((order[lvl] ?? 1) < current) return;
    const line = { ts: new Date().toISOString(), level: lvl, msg, ...extra };
    const fn = lvl === 'error' ? console.error : console.log;
    fn(JSON.stringify(line));
  }

  return {
    debug: (msg, extra) => log('debug', msg, extra),
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra)
  };
}

module.exports = { createLogger };
