# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
# Faster, reproducible installs
COPY package*.json ./
RUN npm ci
COPY . .
# Vite production build to /app/dist
RUN npm run build



# ---- runtime stage ----
FROM nginx:1.27-alpine
# Provide a minimal nginx config that just serves static files
# (we keep it simple because the real reverse proxy is the top-level nginx)
COPY --from=build /app/dist /usr/share/nginx/html
# Disable default server tokens
RUN printf 'server_tokens off;\n' > /etc/nginx/conf.d/server_tokens.conf
# Default nginx image already serves /usr/share/nginx/html on :80
EXPOSE 80
