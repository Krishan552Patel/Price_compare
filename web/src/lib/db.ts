import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL!);

// Wrapper to match the interface used by queries.ts
const db = {
  execute: async (stmt: { sql: string; args?: any[] }) => {
    const { sql: query, args = [] } = stmt;
    // Convert ? placeholders to $1, $2, etc for PostgreSQL
    let pgQuery = query;
    let paramIndex = 0;
    pgQuery = pgQuery.replace(/\?/g, () => `$${++paramIndex}`);
    
    // Use sql.unsafe for dynamic queries with parameters
    const rows = await sql(pgQuery as any, args as any);
    return { rows };
  },
};

export default db;
