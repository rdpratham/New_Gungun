import { Router, Request, Response } from "express";
import { listHistory, clearHistory, historyToCsv } from "../services/historyStore";
import { logger } from "../utils/logger";

export const historyRoutes = Router();

historyRoutes.get("/history", async (_req: Request, res: Response) => {
  try {
    const entries = await listHistory();
    res.status(200).json({ success: true, entries });
  } catch (err) {
    logger.error("Failed to read search history", { reason: (err as Error).message });
    res.status(500).json({ success: false, error: { code: "upstream_error", message: "Could not read search history." } });
  }
});

historyRoutes.delete("/history", async (_req: Request, res: Response) => {
  try {
    await clearHistory();
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Failed to clear search history", { reason: (err as Error).message });
    res.status(500).json({ success: false, error: { code: "upstream_error", message: "Could not clear search history." } });
  }
});

historyRoutes.get("/history/export", async (_req: Request, res: Response) => {
  try {
    const csv = await historyToCsv();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=zoominfo-contact-history.csv");
    res.status(200).send(csv);
  } catch (err) {
    logger.error("Failed to export search history", { reason: (err as Error).message });
    res.status(500).json({ success: false, error: { code: "upstream_error", message: "Could not export search history." } });
  }
});
