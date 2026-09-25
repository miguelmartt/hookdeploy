# 1. Imagen oficial ligera de Node.js basada en Alpine Linux
FROM node:24-alpine

# Docker CLI y compose solo cuando hookdeploy va a desplegar de verdad (VPS).
# Para la práctica se construye sin ellos: imagen ligera.
ARG INSTALL_DOCKER_CLI=false
RUN if [ "$INSTALL_DOCKER_CLI" = "true" ]; then apk add --no-cache docker-cli docker-cli-compose; fi

# Buildinfo (lo inyecta GitHub Actions)
ARG GIT_SHA=unknown
ARG GIT_REF=unknown
ARG BUILD_DATE=unknown
ARG RUN_NUMBER=unknown
ARG RUN_URL=unknown
ENV NODE_ENV=production GIT_SHA=$GIT_SHA GIT_REF=$GIT_REF BUILD_DATE=$BUILD_DATE RUN_NUMBER=$RUN_NUMBER RUN_URL=$RUN_URL

LABEL org.opencontainers.image.source="https://github.com/miguelmartt/hookdeploy" \
      org.opencontainers.image.description="Minimal, secure CD for your own VPS" \
      org.opencontainers.image.licenses="MIT"

# 2. Directorio de trabajo
WORKDIR /app

# 3. Archivos de configuración y código fuente
COPY package*.json ./
COPY server.js ./
COPY src/ ./src/

# Usuario sin privilegios (viene en la imagen oficial)
USER node

# 4. Puerto de escucha
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/health || exit 1

# 5. Comando de ejecución
CMD ["node", "server.js"]
