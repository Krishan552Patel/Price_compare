import { createClient, Client } from "@libsql/client";

let clientInstance: Client | null = null;

function getClient(): Client {
  if (clientInstance) return clientInstance;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables"
    );
  }

  // Handle libsql:// protocol replacement for http client
  // Vercel/Serverless often works better with the HTTP driver
  const safeUrl = url.replace("libsql://", "https://");

  clientInstance = createClient({ url: safeUrl, authToken });
  return clientInstance;
}

// Export a proxy-like object that matches the Client interface for execute/batch
const db = {
  execute: (stmt: any) => {
    return getClient().execute(stmt);
  },
  batch: (stmts: any) => {
    return getClient().batch(stmts);
  },
  // Add other methods if used, but execute/batch are the main ones
};

export default db;
