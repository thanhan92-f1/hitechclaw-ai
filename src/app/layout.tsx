import type { Metadata, Viewport } from "next";
import { Inter, Urbanist } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import ClientShell from "./client-shell";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A0C",
};

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
      <body className="bg-bg-deep text-text antialiased" suppressHydrationWarning>
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
          <ClientShell>{children}</ClientShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
