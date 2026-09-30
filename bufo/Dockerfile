FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs deployment.mjs catalog.mjs jev.mjs core.js app.js index.html styles.css ./
RUN mkdir -m 700 /data && chown node:node /data
USER node
ENV NODE_ENV=production BUFO_MODE=shared BUFO_DATA_DIR=/data PORT=4318
EXPOSE 4318
CMD ["node", "server.mjs"]
