import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/seo";
import { Terminal } from "@/components/og/terminal";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <Terminal
      brand={siteConfig.name}
      title="Buttons with an Evil Touch"
      accent="#ef4444"
    />,
    { ...size },
  );
}
