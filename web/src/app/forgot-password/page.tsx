"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (res.ok) { setSent(true); }
    else { setError("Something went wrong. Please try again."); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-red-500">FAB Tracker</Link>
          <h1 className="text-xl font-semibold text-white mt-3">Reset your password</h1>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-900/30 mb-2">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium">Check your inbox</p>
              <p className="text-gray-400 text-sm">If an account exists for <strong className="text-gray-200">{email}</strong>, a reset link has been sent. It expires in 1 hour.</p>
              <Link href="/login" className="block mt-4 text-red-400 hover:text-red-300 text-sm">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-900/30 border border-red-700/50 text-red-300 text-sm rounded-lg px-4 py-3">{error}</div>}
              <p className="text-gray-400 text-sm">Enter your email and we'll send you a reset link.</p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm">
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <Link href="/login" className="block text-center text-sm text-gray-500 hover:text-gray-300 transition">Back to sign in</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
