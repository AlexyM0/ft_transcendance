FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

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
