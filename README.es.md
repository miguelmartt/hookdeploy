# hookdeploy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node: >=22](https://img.shields.io/badge/Node-%3E%3D22-339933.svg)](https://nodejs.org)
[![Docker: ready](https://img.shields.io/badge/Docker-ready-2496ED.svg)](Dockerfile)
[![CI](https://github.com/miguelmartt/hookdeploy/actions/workflows/deploy.yml/badge.svg)](https://github.com/miguelmartt/hookdeploy/actions/workflows/deploy.yml)

[English](README.md) · Español

Despliegue continuo mínimo y seguro para tu propio VPS: un servidor Node.js sin dependencias que recibe el webhook de GitHub cuando tu pipeline termina en verde, verifica la firma HMAC, comprueba una lista blanca y actualiza el contenedor con `docker compose pull && up -d`.

```
git push ──> GitHub Actions ──> tests OK ──> imagen publicada en GHCR
                                                     │
                                  webhook "workflow_run completed/success"
                                                     │
                                                     v
                           hookdeploy (VPS) ──> verifica HMAC ──> lista blanca
                                                     │
                                       docker compose pull + up -d
                                                     │
                                                     v
                                          nueva versión en marcha
```

> Filosofía: la herramienta hace lo mínimo y solo lo que tú permites. Nunca ejecuta nada derivado del payload del webhook — solo `docker compose pull/up` con argumentos fijos de tu propia configuración validada. Arranca en modo seguro (`DRY_RUN=true`), que solo simula los despliegues.

## Estado actual

La `v0.1.0` es la base de la práctica: servidor HTTP nativo, `GET /`, `/health`, `/version`, test de humo, Dockerfile y CI que construye y prueba la imagen. El listener del webhook (`POST /webhook`), la cola de despliegues y la publicación en GHCR llegan en la `0.2.0`–`0.4.0` (ver Hoja de ruta). Todo, siempre, con cero dependencias de runtime.

## Inicio rápido

Requisitos: Node.js >= 22, pnpm >= 10, Docker para la parte del contenedor.

```sh
pnpm install
pnpm test          # test de la ficha: sirve en el 3001 y espera HTTP 200
pnpm run test:unit # tests de integración (node:test, sin framework)
pnpm run lint      # node --check sobre cada fichero JS
pnpm start
curl -i http://localhost:3000/
```

`npm install` / `npm test` / `npm start` funcionan igual. En CI se usan los
comandos `npm` literales porque la ficha los exige; en local, pnpm es lo
normal.

### Docker (demo de la práctica)

```sh
docker build -t mi-web-node:v1 .
docker run -d --name app-produccion -p 8080:3000 mi-web-node:v1
curl -i http://localhost:8080/
docker stop app-produccion
docker rm app-produccion
```

Sin secreto ni fichero de configuración la app arranca en modo demo: todo
funciona menos `/webhook`, que responde `503 webhook_disabled` hasta que lo
configures.

## API

Todas las respuestas son `application/json; charset=utf-8`. Rutas desconocidas:
`404 {"error":"not_found"}`; rutas conocidas con método incorrecto: `405` con
cabecera `Allow`.

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

Los cuatro primeros campos son literales de la ficha y no se cambian.

### `GET /health`

`200 {"status":"ok","uptime":123.4,"dryRun":true,"webhookEnabled":false}`.
Lo usa el `HEALTHCHECK` de Docker.

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

Los valores salen de `GIT_SHA`, `GIT_REF`, `BUILD_DATE`, `RUN_NUMBER`,
`RUN_URL` inyectadas como build args desde Actions. Sin ellas, cada campo vale
`"unknown"`.

### `POST /webhook` y `GET /deployments`

Previstos para la `0.2.0`/`0.3.0`: verificación HMAC-SHA256 sobre el cuerpo en
bruto, filtro de `workflow_run completed/success` contra la lista blanca de
`hookdeploy.config.json`, cola por app con `docker compose pull/up -d` e
historial de despliegues protegido con bearer token. El contrato completo ya
está congelado en la especificación (llegará a `docs/` en la próxima release).

## Módulos

- `server.js` — punto de entrada. Crea el servidor desde la configuración
  validada y escucha solo si es el proceso principal
  (`require.main === module`), así `test.js` puede usar el 3001 sin el bug
  `ERR_SERVER_ALREADY_LISTEN` de la ficha.
- `src/app.js` — `createApp(config)`: router y handlers, devuelve un
  `http.Server` sin escuchar. Sin frameworks.
- `src/config.js` — `loadConfig(env)`: lee y valida cada variable y la lista
  blanca JSON; devuelve un objeto congelado. Errores claros con prefijo
  `CONFIG:`.
- `src/buildinfo.js` — `getBuildInfo(env, pkg)`: el objeto de `/version`.
- `src/logger.js` — logger JSON por líneas. Nunca registra secretos.
- `test.js` — test de humo de la ficha, con sus mensajes literales.
- `tests/http.test.js` — tests de integración en puerto efímero.

## Configuración

| Variable | Por defecto | Notas |
|---|---|---|
| `PORT` | `3000` | Puerto interno |
| `HOST` | `0.0.0.0` | Interfaz de escucha |
| `WEBHOOK_SECRET` | *(vacío)* | Secreto compartido con GitHub. Vacío = webhook desactivado (demo). Mínimo 32 caracteres |
| `CONFIG_PATH` | `./hookdeploy.config.json` | Fichero de lista blanca. Si falta: lista vacía + aviso |
| `DRY_RUN` | `true` | Solo simula. Hay que ponerlo en `false` explícitamente en producción |
| `DEPLOY_TIMEOUT_MS` | `300000` | Timeout por comando docker |
| `MAX_BODY_BYTES` | `1048576` | Límite del cuerpo del webhook |
| `HISTORY_SIZE` | `20` | Despliegues guardados en memoria |
| `STATUS_TOKEN` | *(vacío)* | Token bearer para `GET /deployments`. Vacío = ruta desactivada |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` o `error` |

Copia `.env.example` a `.env` y `hookdeploy.config.example.json` a
`hookdeploy.config.json` (ambos ignorados por git) para salir del modo demo.

## CI/CD

`.github/workflows/deploy.yml` — jobs `pruebas` ("Ejecutar Tests Unitarios":
checkout, setup Node 24, install, lint, `npm test`, tests unitarios) y después
`construir_docker` ("Construccion de Imagen Docker": build de
`mi-web-node:v1`, arranque, comprobaciones `GET /health` y `GET /`), más un
guard `no_secrets` que falla si hay claves privadas o `.env` / config reales
en el repo.

## Seguridad

Notas honestas, mismo estilo que el resto de la línea VerticeDev:

- El socket de Docker **equivale a root en el host**. Quien controle
  hookdeploy controla el VPS. Por eso el proceso solo ejecuta
  `docker compose -f <ruta de la config> pull|up -d <servicio de la config>`
  con `execFile` y sin shell, con argumentos que salen únicamente de la
  configuración local validada — nunca del payload. La configuración se monta
  en solo lectura y no tiene editor HTTP. Solo `/webhook` se expone a
  internet, detrás de Nginx con TLS. En la hoja de ruta hay un modo con
  proxy del socket o systemd + sudoers restringido.
- HMAC-SHA256 sobre el cuerpo en bruto con comparación en tiempo constante;
  secreto de al menos 32 caracteres; la firma se comprueba antes de parsear
  el JSON.
- Solo despliega `push` a la rama configurada; PRs y forks se ignoran.
- Límite de tamaño, timeouts por comando y caché de entregas duplicadas.
- Modo seguro por defecto (`DRY_RUN=true`); contenedor sin root y sin puertos
  públicos (`127.0.0.1:9000`); `.env` y el config ignorados por git y
  vigilados en CI; los logs nunca llevan secretos.

## Hoja de ruta

| Versión | Contenido |
|---|---|
| **0.1.0** | Base: servidor, `/`, `/health`, `/version`, test de humo, Dockerfile, CI |
| 0.2.0 | `POST /webhook`: raw body, HMAC, filtros, lista blanca, tests |
| 0.3.0 | Cola de despliegues, DRY_RUN, timeout, historial, `/deployments` |
| 0.4.0 | Publicación en GHCR, variante `-cli`, smoke test, badge |
| 1.0.0 | Despliegue real en el VPS, docs completas EN/ES, primera app real |

## Mapeo con la práctica

Hecho para el módulo DAW 0614 (práctica UT01 de despliegue automatizado, RA1).
`GET /`, `test.js`, nombres de jobs y comandos Docker siguen la ficha al pie
de la letra; `server.js` documenta y corrige el bug `ERR_SERVER_ALREADY_LISTEN`
de la ficha (doble `listen`).

## Parte de la línea open source de VerticeDev

- [vpsdoctor-mcp](https://github.com/miguelmartt/vpsdoctor-mcp) — vigilancia del VPS por SSH.
- [vertice-automations](https://github.com/miguelmartt/vertice-automations) — plantillas n8n.
- [biwenger-agent](https://github.com/miguelmartt/biwenger-agent) — agente Python, primer candidato a desplegar.

## Licencia

MIT (c) 2026 Miguel Martínez. Ver [LICENSE](LICENSE).
