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
          justifyContent: "space-between",
          padding: "72px",
          background: "#050505",
          color: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Beam gradient — diagonal red shaft */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(115deg, transparent 35%, rgba(220, 38, 38, 0.05) 45%, rgba(239, 68, 68, 0.45) 50%, rgba(220, 38, 38, 0.05) 55%, transparent 65%)",
          }}
        />

        {/* Subtle red ambient glow */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "15%",
            width: "700px",
            height: "700px",
            borderRadius: "50%",
            display: "flex",
            background:
              "radial-gradient(circle, rgba(127, 29, 29, 0.25) 0%, rgba(127, 29, 29, 0) 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* Top: brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#ef4444",
              display: "flex",
              boxShadow: "0 0 16px rgba(239, 68, 68, 0.8)",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "4px",
              color: "#a3a3a3",
              textTransform: "uppercase",
            }}
          >
            {siteConfig.name}
          </div>
        </div>

        {/* Center: heading + description */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            position: "relative",
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 128,
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "-5px",
                color: "#ffffff",
              }}
            >
              Buttons with
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 128,
                fontWeight: 900,
                lineHeight: 0.95,
                letterSpacing: "-5px",
                background:
                  "linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              an Evil Touch.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.5,
              color: "#a3a3a3",
              maxWidth: "820px",
            }}
          >
            {siteConfig.description}
          </div>
        </div>

        {/* Bottom: meta strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            paddingTop: 20,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 20,
              fontSize: 18,
              color: "#737373",
              fontWeight: 500,
            }}
          >
            <span>shadcn registry</span>
            <span style={{ color: "#525252" }}>·</span>
            <span>Motion</span>
            <span style={{ color: "#525252" }}>·</span>
            <span>TypeScript</span>
            <span style={{ color: "#525252" }}>·</span>
            <span>Tailwind</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#525252",
              fontWeight: 500,
            }}
          >
            evilbuttons.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
