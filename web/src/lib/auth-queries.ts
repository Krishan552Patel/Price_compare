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
  hidden: boolean;
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
            col.quantity, col.condition, col.acquired_price, col.notes, col.hidden,
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
    hidden: Boolean(row.hidden),
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
  data: { quantity?: number; condition?: string; acquiredPrice?: number | null; notes?: string | null; hidden?: boolean }
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | boolean | null)[] = [];
  if (data.quantity !== undefined) { sets.push("quantity = ?"); args.push(data.quantity); }
  if (data.condition !== undefined) { sets.push("condition = ?"); args.push(data.condition); }
  if ("acquiredPrice" in data) { sets.push("acquired_price = ?"); args.push(data.acquiredPrice ?? null); }
  if ("notes" in data) { sets.push("notes = ?"); args.push(data.notes ?? null); }
  if (data.hidden !== undefined) { sets.push("hidden = ?"); args.push(data.hidden); }
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

// ── Borrowing ──────────────────────────────────────────────────

export interface BorrowContact {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
}

export interface BorrowRecord {
  id: string;
  user_id: string;
  contact_id: string;
  contact_name: string;
  card_unique_id: string;
  card_name: string;
  image_url: string | null;
  direction: "borrowed" | "lent";
  qty: number;
  borrowed_date: string;
  returned_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface PublicUser {
  id: string;
  display_name: string | null;
  name: string | null;
}

export interface PublicCollectionRow {
  printing_unique_id: string;
  quantity: number;
  condition: string;
  card_id: string | null;
  card_name: string | null;
  set_name: string | null;
  set_id: string | null;
  rarity: string | null;
  foiling: string | null;
  edition: string | null;
  image_url: string | null;
}

// Contacts CRUD

export async function getBorrowContacts(userId: string): Promise<BorrowContact[]> {
  const r = await db.execute({
    sql: `SELECT id, user_id, name, notes,
               TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
          FROM borrow_contacts WHERE user_id = ? ORDER BY name`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    name: row.name as string,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
  }));
}

export async function createBorrowContact(
  userId: string,
  name: string,
  notes: string | null
): Promise<BorrowContact> {
  const r = await db.execute({
    sql: `INSERT INTO borrow_contacts (user_id, name, notes) VALUES (?, ?, ?) RETURNING id`,
    args: [userId, name.trim(), notes],
  });
  const id = r.rows[0].id as string;
  const all = await getBorrowContacts(userId);
  return all.find((c) => c.id === id)!;
}

export async function updateBorrowContact(
  userId: string,
  id: string,
  name: string,
  notes: string | null
): Promise<void> {
  await db.execute({
    sql: "UPDATE borrow_contacts SET name = ?, notes = ? WHERE id = ? AND user_id = ?",
    args: [name.trim(), notes, id, userId],
  });
}

export async function deleteBorrowContact(userId: string, id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM borrow_contacts WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

// Borrow records CRUD

export async function getBorrowRecords(userId: string): Promise<BorrowRecord[]> {
  const r = await db.execute({
    sql: `SELECT br.id, br.user_id, br.contact_id, bc.name as contact_name,
               br.card_unique_id, br.card_name, br.image_url,
               br.direction, br.qty,
               TO_CHAR(br.borrowed_date, 'YYYY-MM-DD') as borrowed_date,
               TO_CHAR(br.returned_date, 'YYYY-MM-DD') as returned_date,
               br.notes,
               TO_CHAR(br.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
          FROM borrow_records br
          JOIN borrow_contacts bc ON bc.id = br.contact_id
          WHERE br.user_id = ?
          ORDER BY br.returned_date IS NOT NULL, br.borrowed_date DESC`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    contact_id: row.contact_id as string,
    contact_name: row.contact_name as string,
    card_unique_id: row.card_unique_id as string,
    card_name: row.card_name as string,
    image_url: row.image_url as string | null,
    direction: row.direction as "borrowed" | "lent",
    qty: Number(row.qty),
    borrowed_date: row.borrowed_date as string,
    returned_date: row.returned_date as string | null,
    notes: row.notes as string | null,
    created_at: row.created_at as string,
  }));
}

export async function createBorrowRecord(data: {
  userId: string;
  contactId: string;
  cardUniqueId: string;
  cardName: string;
  imageUrl: string | null;
  direction: "borrowed" | "lent";
  qty: number;
  borrowedDate: string;
  notes: string | null;
}): Promise<BorrowRecord> {
  const r = await db.execute({
    sql: `INSERT INTO borrow_records
            (user_id, contact_id, card_unique_id, card_name, image_url, direction, qty, borrowed_date, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id`,
    args: [
      data.userId, data.contactId, data.cardUniqueId, data.cardName,
      data.imageUrl, data.direction, data.qty, data.borrowedDate, data.notes,
    ],
  });
  const id = r.rows[0].id as string;
  const all = await getBorrowRecords(data.userId);
  return all.find((rec) => rec.id === id)!;
}

export async function markBorrowRecordReturned(
  userId: string,
  id: string
): Promise<void> {
  await db.execute({
    sql: `UPDATE borrow_records SET returned_date = CURRENT_DATE
          WHERE id = ? AND user_id = ? AND returned_date IS NULL`,
    args: [id, userId],
  });
}

export async function deleteBorrowRecord(userId: string, id: string): Promise<void> {
  await db.execute({
    sql: "DELETE FROM borrow_records WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

// Public collections / players

export async function searchPublicUsers(query: string): Promise<PublicUser[]> {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q}%`;
  // Exact UUID match works regardless of collection_public (you got the ID privately)
  // Name search only returns users who opted into public discovery
  const r = await db.execute({
    sql: `SELECT id, display_name, name FROM users
          WHERE (
            id::text = ?
            OR (collection_public = true AND LOWER(COALESCE(display_name, name, '')) LIKE LOWER(?))
          )
          ORDER BY COALESCE(display_name, name)
          LIMIT 20`,
    args: [q, like],
  });
  return r.rows.map((row) => ({
    id: row.id as string,
    display_name: row.display_name as string | null,
    name: row.name as string | null,
  }));
}

export async function getUserPublicCollection(userId: string): Promise<PublicCollectionRow[]> {
  const r = await db.execute({
    sql: `SELECT
            col.printing_unique_id, col.quantity, col.condition,
            p.card_id, p.set_id, p.rarity, p.foiling, p.edition, p.image_url,
            c.name as card_name,
            s.name as set_name
          FROM collection col
          JOIN printings p ON p.unique_id = col.printing_unique_id
          JOIN cards c ON c.unique_id = p.card_unique_id
          LEFT JOIN sets s ON s.set_code = p.set_id
          JOIN users u ON u.id = col.user_id
          WHERE col.user_id = ? AND u.collection_public = true AND col.hidden = false
          ORDER BY c.name, p.set_id, col.condition`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    printing_unique_id: row.printing_unique_id as string,
    quantity: Number(row.quantity),
    condition: row.condition as string,
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

export async function setCollectionPublic(userId: string, isPublic: boolean): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET collection_public = ? WHERE id = ?",
    args: [isPublic, userId],
  });
}

export async function updateDisplayName(userId: string, displayName: string | null): Promise<void> {
  await db.execute({
    sql: "UPDATE users SET display_name = ? WHERE id = ?",
    args: [displayName, userId],
  });
}

export async function getPublicUserInfo(userId: string): Promise<PublicUser | null> {
  const r = await db.execute({
    sql: "SELECT id, display_name, name FROM users WHERE id = ? AND collection_public = true LIMIT 1",
    args: [userId],
  });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    id: row.id as string,
    display_name: row.display_name as string | null,
    name: row.name as string | null,
  };
}

export async function getUserCollectionPublicStatus(userId: string): Promise<{ collection_public: boolean; display_name: string | null }> {
  const r = await db.execute({
    sql: "SELECT collection_public, display_name FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  if (!r.rows.length) return { collection_public: false, display_name: null };
  const row = r.rows[0];
  return {
    collection_public: Boolean(row.collection_public),
    display_name: row.display_name as string | null,
  };
}

// ── Friendships ────────────────────────────────────────────────

export interface FriendEntry {
  friendship_id: string;
  id: string;
  display_name: string | null;
  name: string | null;
}

export async function getFriendships(userId: string): Promise<{
  friends: FriendEntry[];
  pendingSent: FriendEntry[];
  pendingReceived: FriendEntry[];
}> {
  const r = await db.execute({
    sql: `SELECT f.id as friendship_id, f.status, f.requester_id,
               u.id as friend_id, u.display_name as friend_display_name, u.name as friend_name
          FROM friendships f
          JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
          WHERE f.requester_id = ? OR f.addressee_id = ?`,
    args: [userId, userId, userId],
  });

  const friends: FriendEntry[] = [];
  const pendingSent: FriendEntry[] = [];
  const pendingReceived: FriendEntry[] = [];

  for (const row of r.rows) {
    const entry: FriendEntry = {
      friendship_id: row.friendship_id as string,
      id: row.friend_id as string,
      display_name: row.friend_display_name as string | null,
      name: row.friend_name as string | null,
    };
    if (row.status === "accepted") {
      friends.push(entry);
    } else if (row.requester_id === userId) {
      pendingSent.push(entry);
    } else {
      pendingReceived.push(entry);
    }
  }

  return { friends, pendingSent, pendingReceived };
}

export async function getFriendshipStatus(
  userId: string,
  otherId: string
): Promise<{ status: "none" | "pending_sent" | "pending_received" | "accepted"; friendship_id: string | null }> {
  const r = await db.execute({
    sql: `SELECT id, status, requester_id FROM friendships
          WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
          LIMIT 1`,
    args: [userId, otherId, otherId, userId],
  });
  if (!r.rows.length) return { status: "none", friendship_id: null };
  const row = r.rows[0];
  const friendship_id = row.id as string;
  if (row.status === "accepted") return { status: "accepted", friendship_id };
  if (row.requester_id === userId) return { status: "pending_sent", friendship_id };
  return { status: "pending_received", friendship_id };
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const r = await db.execute({
    sql: `SELECT 1 FROM friendships
          WHERE status = 'accepted'
          AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
          LIMIT 1`,
    args: [userId1, userId2, userId2, userId1],
  });
  return r.rows.length > 0;
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<string | null> {
  const r = await db.execute({
    sql: `INSERT INTO friendships (requester_id, addressee_id, status)
          VALUES (?, ?, 'pending')
          ON CONFLICT (requester_id, addressee_id) DO NOTHING
          RETURNING id`,
    args: [requesterId, addresseeId],
  });
  return r.rows.length ? (r.rows[0].id as string) : null;
}

export async function acceptFriendRequest(friendshipId: string, userId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE friendships SET status = 'accepted'
          WHERE id = ? AND addressee_id = ? AND status = 'pending'`,
    args: [friendshipId, userId],
  });
}

export async function deleteFriendship(friendshipId: string, userId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM friendships WHERE id = ? AND (requester_id = ? OR addressee_id = ?)`,
    args: [friendshipId, userId, userId],
  });
}

// ── Notifications ──────────────────────────────────────────────

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  from_user_id: string | null;
  from_user_name: string | null;
  friendship_id: string | null;
  read: boolean;
  created_at: string;
}

export async function createNotification(data: {
  userId: string;
  type: string;
  fromUserId: string | null;
  fromUserName: string | null;
  friendshipId: string | null;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO notifications (user_id, type, from_user_id, from_user_name, friendship_id)
          VALUES (?, ?, ?, ?, ?)`,
    args: [data.userId, data.type, data.fromUserId, data.fromUserName, data.friendshipId],
  });
}

export async function getUnreadNotifications(userId: string): Promise<NotificationRow[]> {
  const r = await db.execute({
    sql: `SELECT id, user_id, type, from_user_id, from_user_name, friendship_id, read,
               TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
          FROM notifications
          WHERE user_id = ? AND read = false
          ORDER BY created_at DESC
          LIMIT 20`,
    args: [userId],
  });
  return r.rows.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    type: row.type as string,
    from_user_id: row.from_user_id as string | null,
    from_user_name: row.from_user_name as string | null,
    friendship_id: row.friendship_id as string | null,
    read: Boolean(row.read),
    created_at: row.created_at as string,
  }));
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE notifications SET read = true WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.execute({
    sql: "UPDATE notifications SET read = true WHERE user_id = ? AND read = false",
    args: [userId],
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
