"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = userRoutes;
const userController = require("../controllers/user.controller");
async function userRoutes(fastify, options) {
    fastify.get("/", userController.getAllUsers);
    fastify.get("/:id", userController.getUserById);
    fastify.post("/", userController.createUser);
    fastify.put("/:id", userController.updateUser);
    fastify.delete("/:id", userController.deleteUser);
    //   fastify.post("/register", userController.userRegistration);
    //   fastify.get("/auth/2fa/qr", userController.getQrCode);
    //   fastify.post("/auth/2fa/verify", userController.setMfaCode);
    //   fastify.post("/auth/2fa/skip", userController.skipMfa);
    //   fastify.post("/auth/2fa/login-verify", userController.challengeMfaCode);
    //   fastify.post("/login", userController.classicLogin);
}
//# sourceMappingURL=user.routes.js.map