import { Hono } from "hono";
import { cors } from "hono/cors";
import { createRuntimeEnv, type WorkerEnv } from "./config/env.js";
import { createApiRouter } from "./routes/api.js";
import { createServices } from "./modules/services.js";

function inferStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
    return 404;
  }

  return 500;
}

export function createApp(bindings: WorkerEnv = {}) {
  const app = new Hono<{ Bindings: WorkerEnv }>();
  const allowedOrigin = bindings.FRONTEND_ORIGIN ?? "https://alessandro-scattaglia.github.io";

  app.use(
    "*",
    cors({
      origin: (origin) =>
        origin === allowedOrigin ||
        origin === "http://127.0.0.1:5173" ||
        origin === "http://localhost:5173"
          ? origin
          : undefined
    })
  );
  app.route("/api", createApiRouter(createServices(createRuntimeEnv(bindings))));

  app.notFound((c) => c.json({ error: "Not Found" }, 404));
  app.onError((error, c) => {
    const status = inferStatus(error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    return c.json({ error: message, status }, status as 400 | 401 | 403 | 404 | 500);
  });

  return app;
}

const workerApp = new Hono<{ Bindings: WorkerEnv }>();
workerApp.all("*", (c) => createApp(c.env).fetch(c.req.raw));

export default workerApp;
