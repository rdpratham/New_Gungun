import "dotenv/config";
import express from "express";
import path from "path";
import { searchRoutes } from "./api/searchRoutes";
import { historyRoutes } from "./api/historyRoutes";
import { logger } from "./utils/logger";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(express.json({ limit: "10kb" }));
app.use("/api", searchRoutes);
app.use("/api", historyRoutes);

app.use(express.static(path.join(__dirname, "public")));

// Fallback error handler — never leak stack traces or secrets to the client.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled server error", { reason: (err as Error)?.message });
  res.status(500).json({ success: false, error: { code: "upstream_error", message: "Internal server error." } });
});

app.listen(PORT, () => {
  logger.info(`ZoomInfo Contact Finder running at http://localhost:${PORT}`);
});
