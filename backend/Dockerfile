# ---------- étape build ----------
FROM node:20-alpine AS build
# outils pour compiler les modules natifs
RUN apk add --no-cache python3 make g++
WORKDIR /app

# copie des manifests avant le reste (cache)
COPY package.json tsconfig.json ./
COPY src ./src

# installe toutes les deps et RECOMPILE better-sqlite3 en musl
RUN npm install --build-from-source better-sqlite3 \
 && npm install          # pour les autres dépendances

# transpile TypeScript
RUN npm run build

# ---------- étape runtime ----------
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
ENV NODE_ENV=production
ENV DB_PATH=/data/main.db
ENV PORT=3000
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
