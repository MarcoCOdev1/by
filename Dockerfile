FROM node:24-alpine AS dependencies
WORKDIR /app
# Both SQLite libraries have native addons. Compile when musl prebuilds are absent.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY client ./client
COPY vite.config.js ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
COPY --from=dependencies --chown=node:node /app/dist/client ./dist/client
RUN mkdir -p data/downloads logs public/audio && chown -R node:node data logs public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
