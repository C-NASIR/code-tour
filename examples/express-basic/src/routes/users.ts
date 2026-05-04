import { Router } from "express";
import { createUser, getUserById, listUsers } from "../controllers/userController";

const usersRouter = Router();

usersRouter.get("/", listUsers);
usersRouter.get("/:id", getUserById);
usersRouter.post("/", createUser);

export { usersRouter };
