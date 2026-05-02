import { Router } from "express";
import { createUser, listUsers } from "../controllers/userController";

const usersRouter = Router();

usersRouter.get("/", listUsers);
usersRouter.post("/", createUser);

export { usersRouter };
