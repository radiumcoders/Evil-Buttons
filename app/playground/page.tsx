import type { Metadata } from "next";
import { PlaygroundPage as Playground } from "@/components/landing/playground-page";

export const metadata: Metadata = {
  title: "Playground",
  alternates: {
    canonical: "/playground",
  },
  openGraph: {
    url: "/playground",
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

export default function PlaygroundPage() {
  return <Playground />;
}