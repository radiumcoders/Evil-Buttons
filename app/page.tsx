import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
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

// Stats refresh at most hourly; the rest of the page is static.
export const revalidate = 3600;

export default async function HomePage() {
  const categories = Object.fromEntries(
    source.getPages().map((page) => [page.url, page.data.category]),
  );

  const stats = await getLandingStats();

  return (
    <LandingPage categories={categories}>
      <StatsSection stats={stats} />
    </LandingPage>
  );
}