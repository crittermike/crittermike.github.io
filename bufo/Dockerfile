FROM node:22-bookworm-slim AS service
WORKDIR /app
COPY --chown=node:node package.json server.mjs deployment.mjs usage.mjs catalog.mjs jev.mjs core.js app.js index.html styles.css ./
RUN mkdir -m 700 /data && chown node:node /data
USER node
ENV NODE_ENV=production BUFO_MODE=shared BUFO_DATA_DIR=/data PORT=4318
EXPOSE 4318
CMD ["node", "server.mjs"]

FROM service AS public
COPY --chown=node:node public-assets/ /app/public-assets/
ENV BUFO_MODE=public BUFO_CATALOG_DIR=/app/public-assets

FROM service AS shared
