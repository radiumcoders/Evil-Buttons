import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
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

export default function HomePage() {
  const categories = Object.fromEntries(
    source.getPages().map((page) => [page.url, page.data.category]),
  );

  return <LandingPage categories={categories} />;
}