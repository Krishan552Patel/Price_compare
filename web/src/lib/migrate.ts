/**
 * One-shot DB migration — run with: npx tsx src/lib/migrate.ts
 * Creates user auth, collection, watchlist, and price alert tables.
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function migrate() {
  console.log("Running migration…");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_watchlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_unique_id VARCHAR(255) NOT NULL,
      price_at_add NUMERIC(10,2),
      added_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, card_unique_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS collection (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      printing_unique_id VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      condition VARCHAR(10) NOT NULL DEFAULT 'NM',
      acquired_price NUMERIC(10,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, printing_unique_id, condition)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_unique_id VARCHAR(255) NOT NULL,
      card_name VARCHAR(255) NOT NULL,
      image_url TEXT,
      threshold_cad NUMERIC(10,2) NOT NULL DEFAULT 1.00,
      direction VARCHAR(10) NOT NULL DEFAULT 'both',
      active BOOLEAN NOT NULL DEFAULT true,
      last_price_seen NUMERIC(10,2),
      last_notified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Borrowing ─────────────────────────────────────────────────
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS collection_public BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS display_name TEXT
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS borrow_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS borrow_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id UUID NOT NULL REFERENCES borrow_contacts(id) ON DELETE CASCADE,
      card_unique_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      image_url TEXT,
      direction TEXT NOT NULL CHECK (direction IN ('borrowed', 'lent')),
      qty INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
      borrowed_date DATE NOT NULL DEFAULT CURRENT_DATE,
      returned_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_collection_user ON collection(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_alerts_active ON price_alerts(active) WHERE active = true`;
  await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_user ON user_watchlist(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_borrow_contacts_user ON borrow_contacts(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_borrow_records_user ON borrow_records(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_borrow_records_contact ON borrow_records(contact_id)`;

  console.log("✅ Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
