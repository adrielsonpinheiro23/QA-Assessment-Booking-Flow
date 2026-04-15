import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skip Hire Booking — QA Assessment",
  description:
    "A realistic UK skip-hire booking flow used as the target under test for the QA assessment.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to main content
        </a>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
            <h1 className="text-lg font-semibold">Skip Hire Booking</h1>
            <p className="text-sm text-slate-500">
              QA Assessment — book a skip in 4 steps
            </p>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          {children}
        </main>
        <footer className="mx-auto mt-12 max-w-3xl px-4 py-6 text-center text-xs text-slate-500 sm:px-6">
          Demo build · no real bookings are created
        </footer>
      </body>
    </html>
  );
}
