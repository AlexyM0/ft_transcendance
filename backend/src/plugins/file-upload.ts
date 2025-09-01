// /src/plugins/file-upload.ts
/**
 *
 */
import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { FastifyInstance } from "fastify";
import path from "path";

async function fileUploadPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 2 * 1024 * 1024,
      files: 1,
    }, // 2MB cap, 1 file cap
  });

  await fastify.register(fastifyStatic, {
    root: path.join(process.cwd(), "uploads"),
    prefix: "/uploads/",
    decorateReply: false,
  });
}

export default fp(fileUploadPlugin);
