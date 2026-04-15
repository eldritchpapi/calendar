import { defineConfig } from "drizzle-kit";

const isProd = !!process.env.TURSO_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: isProd ? "turso" : "sqlite",
  dbCredentials: isProd
    ? {
        url: process.env.TURSO_URL!,
        authToken: process.env.TURSO_TOKEN,
      }
    : {
        url: "./data/calendar.db",
      },
});
