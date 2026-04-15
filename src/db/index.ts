import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Local file for dev; TURSO_URL + TURSO_TOKEN for prod.
const url = process.env.TURSO_URL ?? `file:${path.join(dbDir, "calendar.db")}`;
const authToken = process.env.TURSO_TOKEN;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };
