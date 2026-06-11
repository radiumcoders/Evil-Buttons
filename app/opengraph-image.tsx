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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "160%",
            height: "160%",
            display: "flex",
            background:
              "radial-gradient(circle at center, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.08) 25%, rgba(127, 29, 29, 0.03) 45%, #000000 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 180,
            fontWeight: 900,
            letterSpacing: "-8px",
            background:
              "linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)",
            backgroundClip: "text",
            color: "transparent",
            position: "relative",
          }}
        >
          EvilButtons
        </div>
      </div>
    ),
    { ...size },
  );
}
