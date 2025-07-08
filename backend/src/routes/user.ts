import { FastifyInstance } from "fastify";

export const userRoutes = async (app: FastifyInstance) => {
  app.get("/api/me", { preHandler: app.auth }, async (req) => {
    return { user: req.user };
  });
};
