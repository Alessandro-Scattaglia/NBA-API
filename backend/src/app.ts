import cors from "cors";
import express from "express";
import { createApiRouter } from "./routes/api.js";
import { createServices, type AppServices } from "./modules/services.js";

function inferStatus(error: unknown) {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }

  if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
    return 404;
  }

  return 500;
}

export function createApp(services: AppServices = createServices()) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/api", createApiRouter(services));

  app.use((_request, response) => {
    response.status(404).json({
      error: "Not Found"
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const status = inferStatus(error);
    const message = error instanceof Error ? error.message : "Unexpected error";

    response.status(status).json({
      error: message,
      status
    });
  });

  return app;
}
