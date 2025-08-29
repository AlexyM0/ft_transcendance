"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = getAllUsers;
exports.getUserById = getUserById;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
async function getAllUsers(req, rep) {
    try {
        rep.send("GetAllUsers not implemented");
    }
    catch (e) {
        console.log(e.message);
    }
}
async function getUserById(req, rep) {
    try {
        rep.send("Get User by Id not implemented");
    }
    catch (e) {
        console.log(e.message);
    }
}
async function createUser(req, rep) {
    try {
        rep.send("Create user not implemented");
    }
    catch (e) {
        console.log(e.message);
    }
}
async function updateUser(req, rep) {
    try {
        rep.send("Update user not implemented");
    }
    catch (e) {
        console.log(e.message);
    }
}
async function deleteUser(req, rep) {
    try {
        rep.send("Delete user not implemented");
    }
    catch (e) {
        console.log(e.message);
    }
}
//# sourceMappingURL=user.controller.js.map