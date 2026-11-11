import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { publicFeatures } from "@/lib/config";
import { FeaturesProvider } from "@/lib/features";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Goal Tracker", template: "%s · Goal Tracker" },
  description:
    "Turn big, vague goals into numbers, track them, predict your finish date, and stay motivated with AI coaches.",
  applicationName: "Goal Tracker",
  appleWebApp: { capable: true, title: "Goal Tracker", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const features = publicFeatures();
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <FeaturesProvider value={features}>
          <ThemeProvider>
            {children}
            <Toaster
              theme="dark"
              position="top-center"
              richColors
              closeButton
              toastOptions={{ className: "!bg-surface-2 !border-border !text-foreground" }}
            />
            <ServiceWorkerRegister />
          </ThemeProvider>
        </FeaturesProvider>
      </body>
    </html>
  );
}
