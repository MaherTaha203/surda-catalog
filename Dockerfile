# Surda Catalog — single-service production image (Railway).
#
# One container runs the whole app: Fastify serves the API + /uploads AND the
# pre-built static React frontend. SQLite + uploads live on a mounted Volume
# (see CATALOG_DB_PATH / UPLOADS_BASE), so they survive re-deploys.
#
# Node 22 is required: the backend uses the built-in `node:sqlite` (no native
# build step).

# ---- build stage: build the static frontend + install server deps ----------
FROM node:22-slim AS build
WORKDIR /app

# Root deps (Vite + TanStack) then build the static client into dist/.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Server deps. NODE_ENV is NOT production here on purpose: the server runs TS via
# tsx (a devDependency), so dev deps must be installed.
RUN npm --prefix server install --no-audit --no-fund

# ---- runtime stage: lean image that only serves ----------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Built static frontend + server source and its installed node_modules.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

WORKDIR /app/server

# Railway provides $PORT; the server reads process.env.PORT (HOST defaults to
# 0.0.0.0). EXPOSE is documentation only.
EXPOSE 4000

# `npm start` -> `tsx src/index.ts` (cwd = /app/server, so FRONTEND_DIST resolves
# to /app/dist by default).
CMD ["npm", "start"]
