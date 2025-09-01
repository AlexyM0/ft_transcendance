// error-handler.ts
import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from "fastify";
import { AppError } from "../utils/errors";

/**
 * Depending on existing status code, sends a last error status
 */
const errorHandler = function (err: FastifyError, req: FastifyRequest, rep: FastifyReply) {
  if (err instanceof AppError) {
    return rep.code(err.status).send({ error: err.code, message: err.message });
  }

  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  if (status === 500) {
    req.log.error({ err }, "Unexpected error");
  }

  rep.code(status).send({
    error: err.name || "Error",
    message: process.env.NODE_ENV === "production" && status === 500 ? "Internal server error" : err.message,
  });
};

/**
 * Set an error handler (the one above) to a fastify instance passed in parameter
 */
const errorHandlerPlugin = function (fastify: FastifyInstance) {
  fastify.setErrorHandler(errorHandler);
};

/**
 * fp(...) wraps our async function and tells Fastify:
 * - This is a plugin (has a name/version)
 * - Its decorations should be properly exposed to the instance that registered it
 * - We can declare dependencies (not shown here) if needed
 */
export default fp(errorHandlerPlugin, { name: "error-handler" });
