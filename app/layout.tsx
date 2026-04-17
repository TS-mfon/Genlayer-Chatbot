import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GenLayer Knowledge Assistant",
  description: "Closed-domain GenLayer chatbot powered by extractive retrieval and Supabase",
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
        <Providers>
          <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                <h1 className="text-lg font-semibold">GenLayer Knowledge Assistant</h1>
                <nav className="flex items-center gap-4 text-sm">
                  <Link href="/" className="text-slate-300 hover:text-white">
                    Chat
                  </Link>
                  <Link href="/about" className="text-slate-300 hover:text-white">
                    About
                  </Link>
                  <Link href="/admin/dashboard" className="text-slate-300 hover:text-white">
                    Admin
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
