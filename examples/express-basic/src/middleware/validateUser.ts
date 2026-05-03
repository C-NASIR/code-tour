import type { Request, Response } from "express";

export function validateUser(request: Request, response: Response, next: () => void) {
  if (!request.body?.name) {
    response.status(400).json({
      error: "name is required",
    });
    return;
  }

  next();
}
