import { Resend } from "resend";

// Lazy-initialize so the module can be imported at build time without
// RESEND_API_KEY being present. The client is only created when an email
// function is actually called (at runtime, where env vars are available).
function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";
const SITE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ── Password Reset ──────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  rawToken: string
): Promise<void> {
  const resetUrl = `${SITE_URL}/reset-password/${rawToken}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Reset your FAB Tracker password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#e5e7eb;background:#111827;padding:32px;border-radius:12px">
        <h1 style="color:#ef4444;font-size:24px;margin:0 0 16px">FAB Tracker</h1>
        <p style="margin:0 0 16px">We received a request to reset your password.</p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;margin-bottom:16px">
          Reset Password
        </a>
        <p style="font-size:13px;color:#6b7280;margin:0">
          This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

// ── Daily Price Alert Digest ────────────────────────────────────

export interface AlertDigestItem {
  cardName: string;
  imageUrl: string | null;
  oldPrice: number;
  newPrice: number;
  changeAbs: number;
  changePct: number;
  direction: "up" | "down";
  cardUrl: string;
}

export async function sendAlertDigest(
  to: string,
  userName: string | null,
  items: AlertDigestItem[]
): Promise<void> {
  const greeting = userName ? `Hi ${userName},` : "Hi there,";
  const rows = items
    .map((item) => {
      const arrow = item.direction === "up" ? "↑" : "↓";
      const color = item.direction === "up" ? "#4ade80" : "#f87171";
      return `
        <tr style="border-bottom:1px solid #374151">
          <td style="padding:12px 8px">
            <a href="${item.cardUrl}" style="color:#f87171;text-decoration:none;font-weight:600">
              ${item.cardName}
            </a>
          </td>
          <td style="padding:12px 8px;color:#9ca3af">CA$${item.oldPrice.toFixed(2)}</td>
          <td style="padding:12px 8px;font-weight:bold;color:#fff">CA$${item.newPrice.toFixed(2)}</td>
          <td style="padding:12px 8px;font-weight:bold;color:${color}">
            ${arrow} CA$${item.changeAbs.toFixed(2)} (${item.changePct > 0 ? "+" : ""}${item.changePct.toFixed(1)}%)
          </td>
        </tr>`;
    })
    .join("");

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `FAB Tracker: ${items.length} price alert${items.length !== 1 ? "s" : ""} triggered`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#e5e7eb;background:#111827;padding:32px;border-radius:12px">
        <h1 style="color:#ef4444;font-size:24px;margin:0 0 8px">FAB Tracker</h1>
        <h2 style="color:#fff;font-size:18px;font-weight:600;margin:0 0 16px">Daily Price Alert Digest</h2>
        <p style="margin:0 0 24px;color:#9ca3af">${greeting} The following cards crossed your alert thresholds today.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="border-bottom:2px solid #374151;color:#6b7280;text-align:left">
              <th style="padding:8px">Card</th>
              <th style="padding:8px">Was</th>
              <th style="padding:8px">Now (NM)</th>
              <th style="padding:8px">Change</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#4b5563">
          <a href="${SITE_URL}/account/alerts" style="color:#ef4444">Manage your alerts</a>
          &nbsp;·&nbsp;
          <a href="${SITE_URL}" style="color:#ef4444">FAB Tracker</a>
        </p>
      </div>
    `,
  });
}
