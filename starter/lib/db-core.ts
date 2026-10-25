// The database client without the Next.js server-only guard, so seed and record scripts can use it.
// App code imports lib/db, which adds the guard.
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as agentSchema from "./agent-schema"
import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required. See starter/README.md.")

const client = postgres(url, { max: 5 })
export const db = drizzle(client, { schema: { ...schema, ...agentSchema } })
export const closeDb = () => client.end()
