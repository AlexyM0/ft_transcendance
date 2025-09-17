# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
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

# Ensure writable locations for SQLite db and uploads
# If you keep DB inside /app/db/transcendance.db, mount a volume (see compose)
VOLUME ["/app/db", "/app/uploads"]

EXPOSE 5000
CMD ["node", "dist/index.js"]
