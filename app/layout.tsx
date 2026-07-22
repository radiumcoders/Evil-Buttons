import { Geist, Geist_Mono, Inter, Doto } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { JsonLd } from "@/components/seo/json-ld";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";
import {
  createOrganizationJsonLd,
  createSoftwareApplicationJsonLd,
  createWebSiteJsonLd,
  rootMetadata,
} from "@/lib/seo";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dotoVar = Doto({
  variable: "--font-doto",
});

// Keep rootMetadata as the SEO source of truth; restate title/description here
// so the root layout exports complete document metadata without relying only on
// the imported object.
export const metadata: Metadata = {
  ...rootMetadata,
  title: {
    default: "Evil Buttons — Animated shadcn/ui components with Motion",
    template: "%s | Evil Buttons",
  },
  description:
    "A shadcn/ui registry of animated buttons built With an Evil Touch. Live previews, copy-paste docs, and one-command CLI installs.",
};

// Runs before paint so the persisted/system theme is applied without a flash of
// the wrong color scheme. Kept dependency-free and rendered as the first node in
// <body> so it executes during HTML parse, before the app content is painted.
const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "h-full font-sans",
        inter.variable,
        dotoVar.variable,
      )}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <JsonLd
          data={[
            createWebSiteJsonLd(),
            createOrganizationJsonLd(),
            createSoftwareApplicationJsonLd(),
          ]}
        />
        <Analytics />
        <SpeedInsights />
        {/*
          Toast provider intentionally omitted. Copy/async feedback is already
          inline on controls (e.g. CopyButton aria-label + icon swap). Mount
          Sonner only when a real cross-app async feedback need appears — do not
          add an unused toaster solely for audit score.
        */}
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
