# hookdeploy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node: >=22](https://img.shields.io/badge/Node-%3E%3D22-339933.svg)](https://nodejs.org)
[![Docker: ready](https://img.shields.io/badge/Docker-ready-2496ED.svg)](Dockerfile)
[![CI](https://github.com/miguelmartt/hookdeploy/actions/workflows/deploy.yml/badge.svg)](https://github.com/miguelmartt/hookdeploy/actions/workflows/deploy.yml)

English · [Español](README.es.md)

Minimal, secure continuous deployment for your own VPS: a zero-dependency Node.js server that receives the GitHub webhook when your pipeline goes green, verifies the HMAC signature, checks an allowlist, and rolls the container with `docker compose pull && up -d`.

```
git push ──> GitHub Actions ──> tests OK ──> image published to GHCR
                                                     │
                                  webhook "workflow_run completed/success"
                                                     │
                                                     v
                           hookdeploy (VPS) ──> verifies HMAC ──> allowlist
                                                     │
                                       docker compose pull + up -d
                                                     │
                                                     v
                                          new version running
```

> Philosophy: the tool does the minimum, and only what you allow. It never runs anything derived from the webhook payload — only `docker compose pull/up` with fixed arguments from your own validated config. It starts in safe mode (`DRY_RUN=true`), which only simulates deployments.

See [README.es.md](README.es.md) for the Spanish version.

## About this stage

`v0.1.0` is the classroom base: native HTTP server, `GET /`, `/health`, `/version`, smoke test, Dockerfile, and CI that builds and smoke-tests the image. The webhook listener (`POST /webhook`), the deployer queue, and GHCR publishing land in `0.2.0`–`0.4.0` (see Roadmap). Every step keeps zero runtime dependencies.

## Quickstart

Requirements: Node.js >= 22, pnpm >= 10, Docker for the container part.

```sh
pnpm install
pnpm test          # classroom smoke test: serves on 3001, expects HTTP 200
pnpm run test:unit # integration tests (node:test, no framework)
pnpm run lint      # node --check over every JS file
pnpm start
curl -i http://localhost:3000/
```

`npm install` / `npm test` / `npm start` work identically. CI uses the `npm`
commands literally because the classroom assignment requires them; locally,
pnpm is the default.

### Docker (classroom demo)

```sh
docker build -t mi-web-node:v1 .
docker run -d --name app-produccion -p 8080:3000 mi-web-node:v1
curl -i http://localhost:8080/
docker stop app-produccion
docker rm app-produccion
```

Without a secret or config file the app boots in demo mode: everything works
except `/webhook`, which answers `503 webhook_disabled` until you set one up.

## API

All responses are `application/json; charset=utf-8`. Unknown routes return
`404 {"error":"not_found"}`; known routes with a wrong method return `405`
with an `Allow` header.

### `GET /`

```json
{
  "estado": "OK",
  "mensaje": "¡Servidor web desplegado con éxito en el contenedor!",
  "modulo": "DAW - Módulo 0614",
  "timestamp": "2026-10-01T10:00:00.000Z",
  "servicio": "hookdeploy",
  "version": "0.1.0"
}
```

The first four fields are classroom literals and never change.

### `GET /health`

`200 {"status":"ok","uptime":123.4,"dryRun":true,"webhookEnabled":false}`.
Used by the Docker `HEALTHCHECK`.

### `GET /version`

```json
{
  "name": "hookdeploy",
  "version": "0.1.0",
  "commit": "a1b2c3d",
  "ref": "main",
  "buildDate": "2026-10-01T09:58:12Z",
  "runNumber": "42",
  "runUrl": "https://github.com/miguelmartt/hookdeploy/actions/runs/123456",
  "node": "v24.x"
}
```

Values come from `GIT_SHA`, `GIT_REF`, `BUILD_DATE`, `RUN_NUMBER`, `RUN_URL`
injected as build args by Actions. Without them, each field is `"unknown"`.

### `POST /webhook` and `GET /deployments`

Planned for `0.2.0`/`0.3.0`: HMAC-SHA256 verification over the raw body,
`workflow_run completed/success` filtering against the allowlist in
`hookdeploy.config.json`, per-app queue with `docker compose pull/up -d`,
and a bearer-protected deployment history. The full contract is already
frozen in the spec (`docs/` coming with the next release).

## Modules

- `server.js` — entry point. Builds the server from validated config, listens
  only when run directly (`require.main === module`), so `test.js` can bind
  port 3001 without the classroom `ERR_SERVER_ALREADY_LISTEN` bug.
- `src/app.js` — `createApp(config)`: router and handlers, returns an
  `http.Server` without listening. No frameworks.
- `src/config.js` — `loadConfig(env)`: reads and validates every env var and
  the JSON allowlist; returns a deeply frozen object. Clear `CONFIG:` errors.
- `src/buildinfo.js` — `getBuildInfo(env, pkg)`: the `/version` object.
- `src/logger.js` — line-delimited JSON logger. Never logs secrets.
- `test.js` — classroom smoke test with literal messages.
- `tests/http.test.js` — integration tests on an ephemeral port.

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Internal port |
| `HOST` | `0.0.0.0` | Bind interface |
| `WEBHOOK_SECRET` | *(empty)* | Shared secret with GitHub. Empty = webhook disabled (demo). Min 32 chars when set |
| `CONFIG_PATH` | `./hookdeploy.config.json` | Allowlist file. Missing = empty allowlist + warning |
| `DRY_RUN` | `true` | Simulate only. Set explicitly to `false` in production |
| `DEPLOY_TIMEOUT_MS` | `300000` | Per-command docker timeout |
| `MAX_BODY_BYTES` | `1048576` | Webhook body limit |
| `HISTORY_SIZE` | `20` | Deployments kept in memory |
| `STATUS_TOKEN` | *(empty)* | Bearer token for `GET /deployments`. Empty = route disabled |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |

Copy `.env.example` to `.env` and `hookdeploy.config.example.json` to
`hookdeploy.config.json` (both git-ignored) to go beyond demo mode.

## CI/CD

`.github/workflows/deploy.yml` — jobs `pruebas` ("Ejecutar Tests Unitarios":
checkout, setup Node 24, install, lint, `npm test`, unit tests) then
`construir_docker` ("Construccion de Imagen Docker": build `mi-web-node:v1`,
boot it, `GET /health` and `GET /` checks), plus a `no_secrets` guard that
fails on private keys or leaked `.env` / config files.

## Security

Honest notes, same style as the rest of the VerticeDev line:

- The Docker socket **is root on the host**. Whoever controls hookdeploy
  controls the VPS. That is why the process only ever runs
  `docker compose -f <config path> pull|up -d <config service>` via `execFile`
  without a shell, with arguments taken exclusively from the validated local
  config — never from the payload. Config is read-only mounted and has no
  HTTP editor. Only `/webhook` is exposed to the internet, behind Nginx with
  TLS. A socket-proxy or sudoers-restricted systemd mode is on the roadmap.
- HMAC-SHA256 over the raw body with constant-time comparison; secret of at
  least 32 characters; signature checked before JSON parsing.
- Only `push` to the configured branch deploys; PRs and forks are ignored.
- Body size limit, per-command timeouts, duplicate-delivery cache.
- Safe mode by default (`DRY_RUN=true`); non-root container; no public ports
  (`127.0.0.1:9000`); `.env` and the config file are git-ignored and
  CI-guarded; logs never carry secrets.

## Roadmap

| Version | Content |
|---|---|
| **0.1.0** | Base: server, `/`, `/health`, `/version`, smoke test, Dockerfile, CI build |
| 0.2.0 | `POST /webhook`: raw body, HMAC, filters, allowlist, unit tests |
| 0.3.0 | Deployer queue, DRY_RUN, timeout, history, `/deployments` |
| 0.4.0 | GHCR publishing, `-cli` variant, container smoke test, badge |
| 1.0.0 | Real VPS deployment, full EN/ES docs, first real app |

## Classroom mapping

Built for DAW module 0614 (UT01 automated deployment practice, RA1).
`GET /`, `test.js`, job names, and Docker commands follow the assignment
literally; `server.js` documents and fixes the assignment's
`ERR_SERVER_ALREADY_LISTEN` double-listen bug.

## Part of the VerticeDev open source line

- [vpsdoctor-mcp](https://github.com/miguelmartt/vpsdoctor-mcp) — SSH watchdog for the VPS.
- [vertice-automations](https://github.com/miguelmartt/vertice-automations) — n8n templates.
- [biwenger-agent](https://github.com/miguelmartt/biwenger-agent) — Python agent, first deployment candidate.

## License

MIT (c) 2026 Miguel Martínez. See [LICENSE](LICENSE).
