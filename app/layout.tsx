import { Geist, Geist_Mono, Inter, Doto } from "next/font/google";
import "dialkit/styles.css";
import "./globals.css";
import { DialKitRoot } from "@/components/dialkit-root";
import { JsonLd } from "@/components/seo/json-ld";
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

export const metadata = rootMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "h-full font-sans",
        inter.variable,
        dotoVar.variable,
      )}
    >
      <body className="flex h-full flex-col overflow-hidden">
        <JsonLd
          data={[
            createWebSiteJsonLd(),
            createOrganizationJsonLd(),
            createSoftwareApplicationJsonLd(),
          ]}
        />
        <Analytics />
        <SpeedInsights />
        {children}
        <DialKitRoot />
      </body>
    </html>
  );
}
