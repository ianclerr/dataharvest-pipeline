import { Router } from "express";
import db from "../../db/client";

const router = Router();

router.get("/", async (req, res) => {
  try {
    // Sanitizamos page y limit para evitar queries masivas con valores arbitrarios
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { type, minScore } = req.query;

    const query = db("hn_stories").orderBy("scraped_at", "desc")
      .limit(limit).offset(offset);

    if (type) query.where("story_type", type);
    if (minScore) query.where("score", ">=", Number(minScore));

    const stories = await query;
    return res.json(stories);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

router.get("/:hn_item_id", async (req, res) => {
  try {
    const story = await db("hn_stories")
      .where("hn_item_id", req.params.hn_item_id).first();
    if (!story) return res.status(404).json({ error: "Story not found" });
    return res.json(story);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

export default router;