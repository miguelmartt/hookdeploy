# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-25

### Added
- `server.js`: native `node:http` server, exports `http.Server`, listens only when run directly (`require.main === module`), graceful shutdown on SIGTERM/SIGINT.
- `GET /`: classroom JSON (`estado`, `mensaje`, `modulo`, `timestamp`) plus `servicio` and `version`.
- `GET /health` and `GET /version` (buildinfo from `GIT_*` env, `unknown` fallback).
- `test.js`: classroom smoke test on port 3001 with literal messages.
- `tests/http.test.js`: integration tests with `node:test` (no dependencies).
- `src/config.js`: env + `hookdeploy.config.json` allowlist loading and validation, frozen config, safe `DRY_RUN=true` default.
- `src/logger.js`: line-delimited JSON logger, never logs secrets.
- `Dockerfile`: `node:24-alpine`, non-root `node` user, `HEALTHCHECK`, buildinfo `ARG`s, optional Docker CLI via `INSTALL_DOCKER_CLI`.
- CI `deploy.yml`: jobs `pruebas` (lint + smoke + unit tests) and `construir_docker` (build `mi-web-node:v1` + container smoke test), plus `no_secrets` guard.
- pnpm-first local workflow (`packageManager: pnpm@12.6.0`, `pnpm-lock.yaml`); `npm install`/`npm test` keep working for classroom compliance.
