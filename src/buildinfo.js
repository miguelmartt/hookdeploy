function getBuildInfo(env = process.env, pkg = {}) {
  return {
    name: pkg.name || 'hookdeploy',
    version: pkg.version || '0.1.0',
    commit: env.GIT_SHA || 'unknown',
    ref: env.GIT_REF || 'unknown',
    buildDate: env.BUILD_DATE || 'unknown',
    runNumber: env.RUN_NUMBER || 'unknown',
    runUrl: env.RUN_URL || 'unknown',
    node: process.version
  };
}

module.exports = { getBuildInfo };
