import dotenv from "dotenv";
dotenv.config();

import logger from "./logger";

logger.info({ module: "index" }, "DataHarvest Pipeline starting...");