import type { Metadata } from "next";
import { Inter, Urbanist } from "next/font/google";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { NotionShell } from "@/components/mission-control/app-shell";
import { ServiceWorkerRegistration } from "@/components/mission-control/service-worker-registration";
import { ThemeProvider } from "@/components/mission-control/theme-provider";
import "./globals.css";

const urbanist = Urbanist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-urbanist",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "HiTechClaw AI — AI Control Plane",
  description: "Monitor, govern, and manage your AI agent infrastructure. Best with OpenClaw/NemoClaw. Works with anything.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HiTechClaw AI",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
    apple: "/icon-192.svg",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${urbanist.variable} ${inter.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0A0A0C" />
      </head>
      <body className="bg-bg-deep text-text antialiased">
        <ThemeProvider>
        <ServiceWorkerRegistration />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            },
          }}
        />
        <Suspense fallback={<div className="min-h-screen" style={{ background: "#0A0A0C" }} />}>
          <NotionShell>{children}</NotionShell>
        </Suspense>
      </ThemeProvider>
      </body>
    </html>
  );
}
