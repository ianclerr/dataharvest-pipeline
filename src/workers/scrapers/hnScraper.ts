import axios from "axios";
import * as cheerio from "cheerio";
import robotsParser from "robots-parser";
import { RateLimiter } from "../rateLimiter";
import logger from "../../logger";

const BASE_URL = "https://news.ycombinator.com";
const HOST = "news.ycombinator.com";
const USER_AGENT = "DataHarvestBot/1.0 (tech-assessment)";
const rateLimiter = new RateLimiter(1, Number(process.env.RATE_LIMIT_DELAY_MS) || 1000);

let robotsRules: ReturnType<typeof robotsParser> | null = null;

async function getRobotsRules() {
  if (robotsRules) return robotsRules;
  const robotsUrl = `${BASE_URL}/robots.txt`;
  try {
    const { data } = await axios.get(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 5000,
    });
    robotsRules = robotsParser(robotsUrl, data);
  } catch {
    robotsRules = robotsParser(robotsUrl, "");
  }
  return robotsRules;
}

function getStoryType(title: string): string {
  if (title.startsWith("Ask HN")) return "ask";
  if (title.startsWith("Show HN")) return "show";
  return "story";
}

async function scrapePage(url: string) {
  const rules = await getRobotsRules();
  if (!rules.isAllowed(url, USER_AGENT)) {
    throw new Error(`Blocked by robots.txt: ${url}`);
  }
  await rateLimiter.throttle(HOST);
  logger.info({ module: "hnScraper" }, `Fetching ${url}`);
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT },
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

        // Los job posts de YC no tienen subrow con .score ni .hnuser — es el
        // indicador más fiable para distinguirlos de stories/ask/show normales.
        const hasScore = subRow.find(".score").length > 0;
        const hasAuthor = subRow.find(".hnuser").length > 0;
        if (!hasScore && !hasAuthor) {
          logger.info({ module: "hnScraper", hnItemId, title }, "Skipping YC job post");
          continue;
        }

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
