import { Router } from "express";
import db from "../../db/client";

const router = Router();

// GET /api/v1/stories
router.get("/", async (req, res) => {
  try {
    const { type, minScore, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const query = db("hn_stories").orderBy("scraped_at", "desc")
      .limit(Number(limit)).offset(offset);

    if (type) query.where("story_type", type);
    if (minScore) query.where("score", ">=", Number(minScore));

    const stories = await query;
    return res.json(stories);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/stories/:hn_item_id
router.get("/:hn_item_id", async (req, res) => {
  try {
    const story = await db("hn_stories")
      .where("hn_item_id", req.params.hn_item_id).first();
    if (!story) return res.status(404).json({ error: "Story not found" });
    return res.json(story);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;