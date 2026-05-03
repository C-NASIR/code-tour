import type { Request, Response } from "express";
import { UserService } from "../services/userService";

export async function listUsers(_request: Request, response: Response) {
  const users = await UserService.listUsers();
  response.json(users);
}

export async function getUserById(request: Request, response: Response) {
  const user = await UserService.getUserById(Number(request.params.id));
  response.json(user);
}

export async function createUser(request: Request, response: Response) {
  const user = await UserService.createUser(request.body);
  response.status(201).json(user);
}
