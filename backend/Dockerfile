# backend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app

COPY backend/package*.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY shared ./shared

RUN npm run build

FROM node:20-alpine AS prod

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
