import fastify from "fastify";
import fastifySqlite from "fastify-sqlite";
import jwt from "@fastify/jwt";

const app = fastify();
app.register(jwt, { secret: process.env.JWT_SECRET || "devsecret" });
app.register(fastifySqlite, {
  promiseApi: true,
  dbPath: process.env.DB_PATH || "/data/main.db"
});

app.get("/api/ping", async () => ({ pong: true }));
import "./migrate.js"; 
app.listen({ host: "0.0.0.0", port: 3000 });