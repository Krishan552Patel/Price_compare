"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import SearchBar from "./SearchBar";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { href: "/cards", label: "Cards" },
    { href: "/trending", label: "Trending" },
    ...(session?.user
      ? [
          { href: "/watchlist", label: "Watchlist" },
          { href: "/deck-checkout", label: "Deck" },
        ]
      : []),
  ];

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userInitial = session?.user
    ? (session.user.name || session.user.email || "?")[0].toUpperCase()
    : "?";

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-4 h-14">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-red-500 shrink-0">
            FAB Tracker
          </Link>

          {/* Search Bar — desktop */}
          <div className="hidden md:block flex-1 max-w-md">
            <SearchBar />
          </div>

          {/* Nav Links + Auth — desktop */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  isActive(link.href)
                    ? "text-white bg-gray-800"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth section */}
            {session?.user ? (
              <div className="relative ml-2" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800/50 transition"
                >
                  <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {userInitial}
                  </span>
                  <span className="max-w-[120px] truncate">
                    {session.user.name || session.user.email}
                  </span>
                  <svg
                    className={`w-3 h-3 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <Link
                      href="/account"
                      className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Account
                    </Link>
                    <Link
                      href="/account/collection"
                      className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Collection
                    </Link>
                    <Link
                      href="/account/alerts"
                      className="block px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Price Alerts
                    </Link>
                    <div className="border-t border-gray-700" />
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="ml-2 px-3 py-1.5 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile: search icon + hamburger */}
          <div className="flex items-center gap-2 ml-auto md:hidden">
            <button
              className="text-gray-300 hover:text-white p-1"
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                setMenuOpen(false);
              }}
              aria-label="Toggle search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <button
              className="text-gray-300 hover:text-white p-1"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setMobileSearchOpen(false);
              }}
              aria-label="Toggle menu"
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
        </div>

        {/* Mobile search bar */}
        {mobileSearchOpen && (
          <div className="md:hidden pb-3">
            <SearchBar />
          </div>
        )}

        {/* Mobile nav menu */}
        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2 rounded text-sm font-medium transition ${
                  isActive(link.href)
                    ? "text-white bg-gray-800"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-gray-800 my-1" />

            {session?.user ? (
              <>
                <div className="px-3 py-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                    {userInitial}
                  </span>
                  <span className="text-sm text-gray-400 truncate">
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <Link
                  href="/account"
                  className="block px-3 py-2 rounded text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
                  onClick={() => setMenuOpen(false)}
                >
                  My Account
                </Link>
                <Link
                  href="/account/collection"
                  className="block px-3 py-2 rounded text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
                  onClick={() => setMenuOpen(false)}
                >
                  Collection
                </Link>
                <Link
                  href="/account/alerts"
                  className="block px-3 py-2 rounded text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
                  onClick={() => setMenuOpen(false)}
                >
                  Price Alerts
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full text-left px-3 py-2 rounded text-sm font-medium text-red-400 hover:bg-gray-800/50 transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block px-3 py-2 rounded text-sm font-medium text-red-400 hover:bg-gray-800/50 transition"
                onClick={() => setMenuOpen(false)}
              >
                Login / Register
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
