"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*
Main => routes => controllers => models
*/
const fastify_1 = require("fastify");
const fastify = (0, fastify_1.default)({ logger: true });
// Import routes
const user_routes_1 = require("./routes/user.routes");
// Connect to database
// Start the server
fastify.register(user_routes_1.userRoutes, { prefix: "/api/v1/users" });
const start = async () => {
    try {
        await fastify.listen({ port: 5000, host: "0.0.0.0" });
        console.log("Backend server running at http://localhost:5000");
    }
    catch (e) {
        console.log(e);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map