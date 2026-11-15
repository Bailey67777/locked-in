import type { Metadata, Viewport } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/lib/store";
import { HubProvider } from "@/lib/hub/store";
import { VaultProvider } from "@/lib/hub/useVault";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans-face", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Hugo",
  description: "Habits, academics and health.",
  applicationName: "Hugo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hugo",
  },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f3" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <AppProviders>
          <HubProvider>
            <VaultProvider>{children}</VaultProvider>
          </HubProvider>
        </AppProviders>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
