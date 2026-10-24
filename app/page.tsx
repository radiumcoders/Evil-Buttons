import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { SponsorsSection } from "@/components/landing/sponsors-section";
import { source } from "@/lib/source";
import { getStats } from "@/lib/stats";

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

// The sponsor dialog's 30-day page views refresh every 10 minutes.
export const revalidate = 600;

export default async function HomePage() {
  const categories = Object.fromEntries(
    source.getPages().map((page) => [page.url, page.data.category]),
  );

  const { pageViews } = await getStats();

  return (
    <LandingPage categories={categories}>
      <SponsorsSection pageViews={pageViews} />
    </LandingPage>
  );
}