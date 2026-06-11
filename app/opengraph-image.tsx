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
            bottom: "-40%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "140%",
            height: "80%",
            display: "flex",
            background:
              "radial-gradient(ellipse at center, rgba(220, 38, 38, 0.18) 0%, rgba(127, 29, 29, 0.08) 35%, transparent 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 152,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-6px",
              color: "#ffffff",
            }}
          >
            Buttons with
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 152,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-6px",
              background:
                "linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            an Evil Touch.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
