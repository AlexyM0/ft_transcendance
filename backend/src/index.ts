// index.ts
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import { setRouter } from "./routes/Router";
import { db } from "./utils/db";
import dotenv from "dotenv";

// Load env and create the server instance
dotenv.config({ quiet: true });
const fastify = Fastify({ logger: true });

// Register plugins and routes
setRouter(fastify);
db.pragma("foreign_keys = ON");

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 5000, host: "0.0.0.0" });
    console.log("Backend server running at http://localhost:5000");
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

start();
