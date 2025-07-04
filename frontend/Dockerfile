FROM node:20-alpine AS build
WORKDIR /web
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /web
RUN npm install -g serve
COPY --from=build /web/dist .
EXPOSE 80
CMD ["serve", "-s", ".", "-l", "80"]