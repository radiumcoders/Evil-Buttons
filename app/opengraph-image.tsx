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
          fontFamily: "ui-monospace, 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "1200px",
              height: "1200px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(239, 68, 68, 0.55) 0%, rgba(185, 28, 28, 0.35) 20%, rgba(127, 29, 29, 0.15) 40%, transparent 65%)",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 180,
            fontWeight: 900,
            letterSpacing: "-8px",
            color: "#ffffff",
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
