import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Cormorant_Garamond, DM_Sans, EB_Garamond, Fraunces, Geist_Mono, Manrope, Outfit, Space_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/lib/store";
import { HubProvider } from "@/lib/hub/store";
import { VaultProvider } from "@/lib/hub/useVault";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const sans = Manrope({ subsets: ["latin"], variable: "--font-sans-face", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// The looks' typefaces (Settings → Appearance). Not preloaded: a device only fetches the pair its look uses.
// (next/font reads these options at build time, so each has to be written out in full.)
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--font-fraunces" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-dm-sans" });
const bebas = Bebas_Neue({ subsets: ["latin"], display: "swap", preload: false, weight: "400", variable: "--font-bebas" });
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-space-grotesk" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-cormorant" });
const garamond = EB_Garamond({ subsets: ["latin"], display: "swap", preload: false, style: ["normal", "italic"], variable: "--font-eb-garamond" });
const unbounded = Unbounded({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-unbounded" });
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-outfit" });
const lookFonts = [fraunces, dmSans, bebas, grotesk, cormorant, garamond, unbounded, outfit].map((f) => f.variable).join(" ");

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
    <html lang="en" className={`${sans.variable} ${mono.variable} ${lookFonts} h-full antialiased`} suppressHydrationWarning>
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
