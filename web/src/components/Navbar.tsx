"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="text-xl font-bold text-red-500">
            FAB Tracker
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/cards"
              className="text-gray-300 hover:text-white transition"
            >
              Cards
            </Link>
            <Link
              href="/deals"
              className="text-gray-300 hover:text-white transition"
            >
              Deals
            </Link>
          </div>

          <button
            className="md:hidden text-gray-300 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-3 space-y-2">
            <Link
              href="/cards"
              className="block text-gray-300 hover:text-white py-1"
              onClick={() => setMenuOpen(false)}
            >
              Cards
            </Link>
            <Link
              href="/deals"
              className="block text-gray-300 hover:text-white py-1"
              onClick={() => setMenuOpen(false)}
            >
              Deals
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
