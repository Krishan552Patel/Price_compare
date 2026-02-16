const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, "..", ".env");
        if (!fs.existsSync(envPath)) return {};
        const content = fs.readFileSync(envPath, "utf8");
        const env = {};
        content.split("\n").forEach(line => {
            const parts = line.split("=");
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
                if (key && !key.startsWith("#")) env[key] = val;
            }
        });
        return env;
    } catch (e) {
        console.error("Error reading .env:", e);
        return {};
    }
}

async function main() {
    const env = loadEnv();
    const url = env.TURSO_DATABASE_URL?.replace("libsql://", "https://");
    const authToken = env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error("Missing TURSO credentials in ../.env");
        return;
    }

    const db = createClient({ url, authToken });

    const query = "Snatch";
    const groupByPrinting = true;
    const pageSize = 24;
    const offset = 0;

    console.log(`Testing search for "${query}" with groupByPrinting=${groupByPrinting}`);

    const joinClause = "JOIN printings p ON p.card_unique_id = c.unique_id";
    const whereClause = "WHERE c.name LIKE ?";
    const args = [`%${query}%`];

    const countSql = `SELECT COUNT(DISTINCT p.unique_id) as total FROM cards c ${joinClause} ${whereClause}`;

    try {
        console.log("Executing COUNT:", countSql, args);
        const countResult = await db.execute({ sql: countSql, args });
        console.log("Count Result:", countResult.rows[0]);
    } catch (e) {
        console.error("COUNT FAILED:", e);
    }

    const sql = `SELECT p.unique_id as printing_uid, c.name, c.color, c.pitch, c.types, c.type_text,
             p.image_url as image_url, p.set_id as set_id, p.rarity, p.foiling,
             (SELECT s.name FROM sets s WHERE s.set_code = p.set_id) as set_name
           FROM cards c
           ${joinClause}
           ${whereClause}
           ORDER BY c.name, p.set_id
           LIMIT ? OFFSET ?`;

    try {
        const mainArgs = [...args, pageSize, offset];
        console.log("Executing MAIN:", sql, mainArgs);
        const result = await db.execute({ sql, args: mainArgs });
        console.log(`Found ${result.rows.length} rows`);
        if (result.rows.length > 0) {
            console.log("First row:", result.rows[0]);
        }
    } catch (e) {
        console.error("MAIN QUERY FAILED:", e);
    }
}

main();
