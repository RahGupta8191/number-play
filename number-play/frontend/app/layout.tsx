import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Number Play — Adaptive Tutoring System",
  description:
    "Intelligent Tutoring System for Number Play — adaptive learning for Grade 7 students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-gray-50 font-fun">
        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-brand-purple font-black text-xl tracking-tight">
              Number Play
            </a>
            <div className="flex items-center gap-6 text-sm font-semibold text-gray-500">
              <a href="/chapter" className="hover:text-brand-purple transition-colors">
                Lectures
              </a>
              <a href="/learn" className="hover:text-brand-purple transition-colors">
                Practice
              </a>
              <a href="/dashboard" className="hover:text-brand-purple transition-colors">
                Progress
              </a>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>

        {/* Footer */}
        <footer className="border-t border-gray-200 mt-12">
          <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
            <span>Number Play ITS — ET 605 Assignment</span>
            <span>Anika Sahoo · Harshil Singla · Rahul Gupta</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
