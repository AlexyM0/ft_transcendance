# ---------- étape build ----------
FROM node:20-alpine AS build

# Outils nécessaires à la compilation de modules natifs (ex: better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copie des fichiers essentiels avant le reste pour optimiser le cache
COPY package.json tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

# Installation des dépendances, avec recompilation explicite de better-sqlite3
RUN npm install --build-from-source better-sqlite3 \
 && npm install

# Transpilation du TypeScript vers JavaScript
RUN npm run build

# ---------- étape runtime ----------
FROM node:20-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/migrations ./migrations

ENV NODE_ENV=production
ENV DB_PATH=/data/main.db
ENV PORT=3000

VOLUME /data
EXPOSE 3000

CMD ["node", "dist/index.js"]
