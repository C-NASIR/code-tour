import express from "express";
import { usersRouter } from "./routes/users";

const app = express();

app.use(express.json());
app.use("/users", usersRouter);

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

export { app };
