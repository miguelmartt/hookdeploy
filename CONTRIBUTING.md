# Contributing to hookdeploy

## Local setup

Requirements: Node.js >= 22 and pnpm >= 10.

```sh
pnpm install
pnpm test        # classroom smoke test (port 3001)
pnpm run test:unit
pnpm run lint
pnpm start
```

`npm install` and `npm test` also work. CI uses the `npm` commands literally
because the classroom assignment requires them; locally, pnpm is the default.

## Commits

Conventional Commits: `feat:`, `fix:`, `ci:`, `docs:`, `test:`, `chore:`.

## Rules

- Zero runtime dependencies. Only `node:*` modules. If you ever need one,
  justify it in the CHANGELOG first.
- Never use `exec`, `spawn` with shell, or `shell: true`. Only
  `execFile('docker', [...args])` with arguments taken exclusively from the
  validated configuration. Nothing from the webhook payload may reach a command.
- Verify the HMAC signature before parsing the JSON body, over the raw buffer.
- Never log secrets, full signatures, or full payloads. Log repo, event,
  delivery id, commit, and decision only.
- New security checks in PRs are welcome. Document the why, not just the what.
- Keep the classroom literals untouched: `GET /` fields, `test.js` messages,
  job names `pruebas` / `construir_docker`, workflow name.
