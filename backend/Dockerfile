# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy source (TS + SQL migrations + uploads assets)
COPY tsconfig.json ./
COPY src ./src
COPY db ./db
COPY uploads ./uploads

# Compile TypeScript to /app/dist
RUN npm run build


# ---- runtime stage ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled app and required runtime assets
COPY --from=build /app/dist ./dist
# DB migrations and any runtime SQL need to be present
COPY --from=build /app/db ./db
# Static/uploads folders if your API serves them
COPY --from=build /app/uploads ./uploads

# Entrypoint runs migrate then server
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Persist DB & uploads between container restarts
VOLUME ["/app/db", "/app/uploads"]

EXPOSE 5000
ENTRYPOINT ["/docker-entrypoint.sh"]
