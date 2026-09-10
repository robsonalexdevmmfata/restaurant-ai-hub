import { closeDb } from "./db/index.js";
import { startServer } from "./app.js";

const app = await startServer();

async function shutdown() {
  await app.close();
  await closeDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
