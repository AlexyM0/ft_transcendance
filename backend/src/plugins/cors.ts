// cors.ts
/**
 * fastify-plugin lets you wrap a function so Fastify knows it’s a plugin.
 * Why? It makes dependency resolution cleaner (plugins can depend on each other,
 * load order is respected, etc.).
 *
 * cors is the actual CORS plugin.
 * It adds the logic that inspects requests and sets the Access-Control-* headers in responses.
 */
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { FastifyInstance } from "fastify";
import { err } from "../utils/errors";

const isProd = process.env.NODE_ENV === "production";

/**
 * Build a list of “origins” (frontend URLs) that are allowed to call your backend.
 */
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",").map((s) => s.trim());

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: function checkOrigin(requestOrigin: string | undefined, callback) {
      if (!requestOrigin || ALLOWED_ORIGINS.includes(requestOrigin)) return callback(null, true);
      callback(err("NOT_ALLOWED_BY_CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  });
}

export default fp(corsPlugin, { name: "cors" });
