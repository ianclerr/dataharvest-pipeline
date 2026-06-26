import axios from "axios";
import * as cheerio from "cheerio";
import { RateLimiter } from "../rateLimiter";
import logger from "../../logger";

const BASE_URL = "https://news.ycombinator.com";
const HOST = "news.ycombinator.com";
const rateLimiter = new RateLimiter();

function getStoryType(title: string): string {
  if (title.startsWith("Ask HN")) return "ask";
  if (title.startsWith("Show HN")) return "show";
  if (title.toLowerCase().includes("hiring")) return "job";
  return "story";
}

async function scrapePage(url: string) {
  await rateLimiter.throttle(HOST);
  logger.info({ module: "hnScraper" }, `Fetching ${url}`);
  const { data } = await axios.get(url, {
    headers: { "User-Agent": "DataHarvestBot/1.0 (tech-assessment)" },
    timeout: Number(process.env.REQUEST_TIMEOUT_MS) || 10000,
  });
  logger.info({ module: "hnScraper" }, `Fetched ${url}`);
  return cheerio.load(data);
}

export async function scrapeHN() {
  const stories = [];
  const seenIds = new Set<number>();

  for (let page = 1; page <= 2; page++) {
    const url = `${BASE_URL}/newest?p=${page}`;
    logger.info({ module: "hnScraper", page }, "Scraping HN pages");

    try {
      const $ = await scrapePage(url);
      const rows = $("tr.athing").toArray();

      for (const row of rows) {
        const hnItemId = parseInt($(row).attr("id") || "0");
        if (!hnItemId || seenIds.has(hnItemId)) continue;
        seenIds.add(hnItemId);

        const titleEl = $(row).find(".titleline a").first();
        const title = titleEl.text().trim();
        const url_ = titleEl.attr("href") || null;

        const subRow = $(row).next("tr");
        const score = parseInt(subRow.find(".score").text()) || 0;
        const author = subRow.find(".hnuser").text().trim();
        const ageText = subRow.find(".age").text().trim();
        const commentText = subRow.find("a").last().text();
        const commentCount = parseInt(commentText) || 0;
        const storyType = getStoryType(title);

        stories.push({
          hn_item_id: hnItemId,
          title,
          url: url_?.startsWith("http") ? url_ : null,
          score,
          author,
          age_text: ageText,
          comment_count: commentCount,
          story_type: storyType,
        });
      }
    } catch (err) {
      logger.warn({ module: "hnScraper", page, err }, "Failed to scrape page, continuing with what we have");
    }
  }

  return stories;
}