import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/seo";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0c0000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-30%",
            right: "-15%",
            width: "80%",
            height: "130%",
            background:
              "radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.08) 40%, transparent 70%)",
          }}
        />

        <div
          style={{
            position: "relative",
            fontSize: 140,
            fontWeight: 900,
            letterSpacing: "-6px",
            color: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {siteConfig.name}
        </div>
      </div>
    ),
    { ...size },
  );
}
