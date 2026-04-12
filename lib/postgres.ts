import postgres, { Sql } from "postgres";
import { env } from "@/lib/env";

let sqlClient: Sql | null = null;

export function getSqlClient() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for SQL console access.");
  }

  if (!sqlClient) {
    sqlClient = postgres(env.DATABASE_URL, {
      max: 1,
      prepare: false,
      ssl: "require",
    });
  }

  return sqlClient;
}
