import type { Request, Response } from "express";

export function validateUser(request: Request, response: Response, next: () => void) {
  if (!request.body?.email) {
    response.status(400).json({
      error: "email is required",
    });
    return;
  }

  next();
}
