import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";
import { Navbar } from "@/components/landing/landing-page";
import { StatsSection } from "@/components/stats/stats-section";
import { getStats } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Stats",
  description: "GitHub stars, page views, top referrers and the most-copied Evil Buttons, live.",
  alternates: {
    canonical: "/stats",
  },
};

// The 30-day stats refresh every 10 minutes.
export const revalidate = 600;

export default async function StatsPage() {
  const stats = await getStats();

  return (
    // <body> never scrolls, so the page is its own scroll container, as on the landing.
    <div className="docs-scroll h-full overflow-y-auto bg-background text-foreground">
      <Navbar />
      <StatsSection stats={stats} />
      <LandingFooter />
    </div>
  );
}
