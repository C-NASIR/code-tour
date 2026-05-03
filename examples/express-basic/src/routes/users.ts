import { Router } from "express";
import { createUser, getUserById, listUsers } from "../controllers/userController";
import { validateUser } from "../middleware/validateUser";

const usersRouter = Router();

usersRouter.get("/", listUsers);
usersRouter.get("/:id", getUserById);
usersRouter.post("/", validateUser, createUser);

export { usersRouter };
