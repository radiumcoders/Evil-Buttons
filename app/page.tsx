import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { SponsorsSection } from "@/components/landing/sponsors-section";
import { StatsSection } from "@/components/landing/stats-section";
import { getLandingStats } from "@/lib/landing-stats";
import { source } from "@/lib/source";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Evil Buttons",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

// The 30-day stats refresh every 10 minutes; live visitors poll on their own.
export const revalidate = 600;

export default async function HomePage() {
  const categories = Object.fromEntries(
    source.getPages().map((page) => [page.url, page.data.category]),
  );

  const stats = await getLandingStats();

  return (
    <LandingPage categories={categories}>
      <StatsSection stats={stats} />
      <SponsorsSection visitors={stats.visitors} />
    </LandingPage>
  );
}