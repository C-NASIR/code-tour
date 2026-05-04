import type { Request, Response } from "express";
import { UserService } from "../services/userService";

export async function listUsers(request: Request, response: Response) {
  const { limit } = request.query;
  const users = await UserService.listUsers(limit ? Number(limit) : undefined);
  response.json(users);
}

export async function getUserById(request: Request, response: Response) {
  const { id } = request.params;
  const user = await UserService.getUserById(Number(id));

  if (!user) {
    return response.status(404).json({
      error: "user not found",
    });
  }

  response.json(user);
}

export async function createUser(request: Request, response: Response) {
  const { email, name } = request.body;

  if (!email) {
    return response.status(400).json({
      error: "email is required",
    });
  }

  const user = await UserService.createUser({ email, name });
  return response.status(201).json(user);
}
