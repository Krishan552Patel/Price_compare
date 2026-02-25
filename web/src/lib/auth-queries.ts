import db from "./db";
import crypto from "crypto";

// ── Types ──────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
}

export interface CollectionRow {
  id: string;
  user_id: string;
  printing_unique_id: string;
  quantity: number;
  condition: string;
  acquired_price: number | null;
  notes: string | null;
  created_at: string;
  // joined
  card_id: string | null;
  card_name: string | null;
  set_name: string | null;
  set_id: string | null;
  rarity: string | null;
  foiling: string | null;
  edition: string | null;
  image_url: string | null;
}

export interface AlertRow {
  id: string;
  user_id: string;
  card_unique_id: string;
  card_name: string;
  image_url: string | null;
  threshold_cad: number;
  direction: string;
  active: boolean;
  last_price_seen: number | null;
  last_notified_at: string | null;
  created_at: string;
}

export interface WatchlistRow {
  card_unique_id: string;
  card_name: string | null;
  image_url: string | null;
  price_at_add: number | null;
  added_at: string;
}

// ── Users ──────────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const r = await db.execute({
    sql: "SELECT * FROM users WHERE email = ? LIMIT 1",
    args: [email.toLowerCase().trim()],
  });
  return r.rows.length ? (r.rows[0] as unknown as DbUser) : null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const r = await db.execute({
    sql: "SELECT * FROM users WHERE id = ? LIMIT 1",
    args: [id],
  });
  return r.rows.length ? (r.rows[0] as unknown as DbUser) : null;
}

export async function createUser(data: {
  email: string;
  password_hash: string;
  name: string;
}): Promise<DbUser> {
  const r = await db.execute({
    sql: `INSERT INTO users (email, password_hash, name)
          VALUES (?, ?, ?)
          RETURNING *`,
    args: [data.email.toLowerCase().trim(), data.password_hash, data.name],
  });
  return r.rows[0] as unknown as DbUser;
}

export async function updateUserPassword(
  userId: string,
  password_hash: string
): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET password_hash = ? WHERE id = ?",
    args: [password_hash, userId],
  });
}

// ── Password Reset Tokens ──────────────────────────────────────

/** Returns the raw token (to send in email), stores hash in DB */
export async function createPasswordResetToken(
  userId: string
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any existing unused tokens for this user
  await db.execute({
    sql: "DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL",
    args: [userId],
  });

  await db.execute({
    sql: `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES (?, ?, ?)`,
    args: [userId, tokenHash, expiresAt.toISOString()],
  });

  return rawToken;
}

/** Returns userId if token is valid + unexpired, otherwise null */
export async function verifyAndConsumeResetToken(
  rawToken: string
): Promise<string | null> {
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const r = await db.execute({
    sql: `SELECT id, user_id, expires_at, used_at
          FROM password_reset_tokens
          WHERE token_hash = ? LIMIT 1`,
    args: [tokenHash],
  });

  if (!r.rows.length) return null;
  const row = r.rows[0] as Record<string, unknown>;
  if (row.used_at) return null;
  if (new Date(row.expires_at as string) < new Date()) return null;

  // Mark as used
  await db.execute({
    sql: "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
    args: [row.id as string],
  });

  return row.user_id as string;
}

// ── Watchlist ──────────────────────────────────────────────────

export async function getServerWatchlist(userId: string): Promise<WatchlistRow[]> {
  const r = await db.execute({
    sql: `SELECT uw.card_unique_id, uw.price_at_add,
               TO_CHAR(uw.added_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as added_at,
               c.name as card_name,
               (SELECT image_url FROM printings
                WHERE card_unique_id = uw.card_unique_id AND image_url IS NOT NULL
                ORDER BY card_id LIMIT 1) as image_url
          FROM user_watchlist uw
          LEFT JOIN cards c ON c.unique_id = uw.card_unique_id
          WHERE uw.user_id = ? ORDER BY uw.added_at DESC`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    card_unique_id: row.card_unique_id as string,
    card_name: row.card_name as string | null,
    image_url: row.image_url as string | null,
    price_at_add: row.price_at_add ? Number(row.price_at_add) : null,
    added_at: row.added_at as string,
  }));
}

export async function addToServerWatchlist(
  userId: string,
  cardUniqueId: string,
  priceAtAdd: number | null
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO user_watchlist (user_id, card_unique_id, price_at_add)
          VALUES (?, ?, ?)
          ON CONFLICT (user_id, card_unique_id) DO NOTHING`,
    args: [userId, cardUniqueId, priceAtAdd],
  });
}

export async function removeFromServerWatchlist(
  userId: string,
  cardUniqueId: string
): Promise<void> {
  await db.execute({
    sql: "DELETE FROM user_watchlist WHERE user_id = ? AND card_unique_id = ?",
    args: [userId, cardUniqueId],
  });
}

// ── Collection ─────────────────────────────────────────────────

export async function getCollection(userId: string): Promise<CollectionRow[]> {
  const r = await db.execute({
    sql: `SELECT
            col.id, col.user_id, col.printing_unique_id,
            col.quantity, col.condition, col.acquired_price, col.notes,
            TO_CHAR(col.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
            p.card_id, p.set_id, p.rarity, p.foiling, p.edition, p.image_url,
            c.name as card_name,
            s.name as set_name
          FROM collection col
          JOIN printings p ON p.unique_id = col.printing_unique_id
          JOIN cards c ON c.unique_id = p.card_unique_id
          LEFT JOIN sets s ON s.set_code = p.set_id
          WHERE col.user_id = ?
          ORDER BY c.name, p.set_id, col.condition`,
    args: [userId],
  });

  return r.rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    printing_unique_id: row.printing_unique_id as string,
    quantity: Number(row.quantity),
    condition: row.condition as string,
    acquired_price: row.acquired_price ? Number(row.acquired_price) : null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
    card_id: row.card_id as string | null,
    card_name: row.card_name as string | null,
    set_name: row.set_name as string | null,
    set_id: row.set_id as string | null,
    rarity: row.rarity as string | null,
    foiling: row.foiling as string | null,
    edition: row.edition as string | null,
    image_url: row.image_url as string | null,
  }));
}

export async function addToCollection(data: {
  userId: string;
  printingUniqueId: string;
  quantity: number;
  condition: string;
  acquiredPrice: number | null;
  notes: string | null;
}): Promise<CollectionRow> {
  const r = await db.execute({
    sql: `INSERT INTO collection (user_id, printing_unique_id, quantity, condition, acquired_price, notes)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (user_id, printing_unique_id, condition)
          DO UPDATE SET quantity = collection.quantity + EXCLUDED.quantity
          RETURNING id`,
    args: [
      data.userId,
      data.printingUniqueId,
      data.quantity,
      data.condition,
      data.acquiredPrice,
      data.notes,
    ],
  });
  const id = r.rows[0].id as string;
  const all = await getCollection(data.userId);
  return all.find((c) => c.id === id)!;
}

export async function updateCollectionEntry(
  userId: string,
  id: string,
  data: { quantity?: number; condition?: string; acquiredPrice?: number | null; notes?: string | null }
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (data.quantity !== undefined) { sets.push("quantity = ?"); args.push(data.quantity); }
  if (data.condition !== undefined) { sets.push("condition = ?"); args.push(data.condition); }
  if ("acquiredPrice" in data) { sets.push("acquired_price = ?"); args.push(data.acquiredPrice ?? null); }
  if ("notes" in data) { sets.push("notes = ?"); args.push(data.notes ?? null); }
  if (!sets.length) return;
  args.push(id, userId);
  await db.execute({ sql: `UPDATE collection SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, args });
}

export async function deleteCollectionEntry(userId: string, id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM collection WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

// ── Price Alerts ───────────────────────────────────────────────

export async function getAlerts(userId: string): Promise<AlertRow[]> {
  const r = await db.execute({
    sql: `SELECT id, user_id, card_unique_id, card_name, image_url,
               threshold_cad, direction, active, last_price_seen,
               TO_CHAR(last_notified_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_notified_at,
               TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
          FROM price_alerts WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    card_unique_id: row.card_unique_id as string,
    card_name: row.card_name as string,
    image_url: row.image_url as string | null,
    threshold_cad: Number(row.threshold_cad),
    direction: row.direction as string,
    active: Boolean(row.active),
    last_price_seen: row.last_price_seen ? Number(row.last_price_seen) : null,
    last_notified_at: row.last_notified_at as string | null,
    created_at: row.created_at as string,
  }));
}

export async function createAlert(data: {
  userId: string;
  cardUniqueId: string;
  cardName: string;
  imageUrl: string | null;
  thresholdCad: number;
  direction: string;
  lastPriceSeen: number | null;
}): Promise<AlertRow> {
  const r = await db.execute({
    sql: `INSERT INTO price_alerts
            (user_id, card_unique_id, card_name, image_url, threshold_cad, direction, last_price_seen)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT DO NOTHING
          RETURNING id`,
    args: [
      data.userId, data.cardUniqueId, data.cardName, data.imageUrl,
      data.thresholdCad, data.direction, data.lastPriceSeen,
    ],
  });
  const id = r.rows[0]?.id as string;
  const all = await getAlerts(data.userId);
  return all.find((a) => a.id === id) ?? all[0];
}

export async function updateAlert(
  userId: string,
  id: string,
  data: { active?: boolean; thresholdCad?: number; direction?: string }
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | boolean)[] = [];
  if (data.active !== undefined) { sets.push("active = ?"); args.push(data.active); }
  if (data.thresholdCad !== undefined) { sets.push("threshold_cad = ?"); args.push(data.thresholdCad); }
  if (data.direction !== undefined) { sets.push("direction = ?"); args.push(data.direction); }
  if (!sets.length) return;
  args.push(id, userId);
  await db.execute({ sql: `UPDATE price_alerts SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`, args });
}

export async function deleteAlert(userId: string, id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM price_alerts WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

// ── Alert processing (cron) ────────────────────────────────────

export interface ActiveAlertWithPrice {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  card_unique_id: string;
  card_name: string;
  image_url: string | null;
  threshold_cad: number;
  direction: string;
  last_price_seen: number | null;
}

export async function getAllActiveAlertsWithUsers(): Promise<ActiveAlertWithPrice[]> {
  const r = await db.execute({
    sql: `SELECT pa.id, pa.user_id, u.email as user_email, u.name as user_name,
               pa.card_unique_id, pa.card_name, pa.image_url,
               pa.threshold_cad, pa.direction, pa.last_price_seen
          FROM price_alerts pa
          JOIN users u ON u.id = pa.user_id
          WHERE pa.active = true`,
    args: [],
  });
  return r.rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    user_email: row.user_email as string,
    user_name: row.user_name as string | null,
    card_unique_id: row.card_unique_id as string,
    card_name: row.card_name as string,
    image_url: row.image_url as string | null,
    threshold_cad: Number(row.threshold_cad),
    direction: row.direction as string,
    last_price_seen: row.last_price_seen ? Number(row.last_price_seen) : null,
  }));
}

export async function bulkUpdateAlertPrices(
  updates: { id: string; last_price_seen: number; last_notified_at?: boolean }[]
): Promise<void> {
  if (updates.length === 0) return;

  // Single UPDATE for all last_price_seen values — one DB round-trip regardless
  // of how many alerts exist, instead of N individual round-trips.
  const valuePlaceholders = updates.map(() => "(?, ?::numeric)").join(", ");
  const priceArgs = updates.flatMap((u) => [u.id, u.last_price_seen]);
  await db.execute({
    sql: `UPDATE price_alerts
          SET last_price_seen = v.price
          FROM (VALUES ${valuePlaceholders}) AS v(id, price)
          WHERE price_alerts.id = v.id::uuid`,
    args: priceArgs,
  });

  // Second single UPDATE only for triggered alerts (need last_notified_at = NOW())
  const triggeredIds = updates.filter((u) => u.last_notified_at).map((u) => u.id);
  if (triggeredIds.length > 0) {
    const idPlaceholders = triggeredIds.map(() => "?::uuid").join(", ");
    await db.execute({
      sql: `UPDATE price_alerts SET last_notified_at = NOW() WHERE id IN (${idPlaceholders})`,
      args: triggeredIds,
    });
  }
}
