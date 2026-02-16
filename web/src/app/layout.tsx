import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FAB Price Tracker",
  description:
    "Compare Flesh and Blood TCG card prices across Canadian retailers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        <main className="min-h-screen">{children}</main>
        <footer className="border-t border-gray-800 py-6 text-center text-sm text-gray-500">
          <p>
            Card data from{" "}
            <a
              href="https://github.com/the-fab-cube/flesh-and-blood-cards"
              className="text-gray-400 hover:text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              the-fab-cube
            </a>
            . Prices scraped from Canadian retailers.
          </p>
        </footer>
      </body>
    </html>
  );
}
