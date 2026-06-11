import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/seo";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          padding: "80px",
          background:
            "radial-gradient(ellipse at 50% 50%, #1a0000 0%, #000000 75%)",
          color: "#fafafa",
          fontFamily: "Doto, ui-sans-serif, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Diagonal beam — main red shaft */}
        <div
          style={{
            position: "absolute",
            top: "-50%",
            left: "-20%",
            width: "180%",
            height: "200%",
            background:
              "linear-gradient(115deg, transparent 30%, rgba(239, 68, 68, 0) 38%, rgba(239, 68, 68, 0.55) 50%, rgba(220, 38, 38, 0.15) 62%, transparent 70%)",
            transform: "rotate(-12deg)",
            display: "flex",
            filter: "blur(8px)",
          }}
        />

        {/* Secondary thin beam */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "10%",
            width: "120%",
            height: "160%",
            background:
              "linear-gradient(115deg, transparent 45%, rgba(127, 29, 29, 0) 49%, rgba(185, 28, 28, 0.35) 52%, rgba(127, 29, 29, 0) 55%, transparent 60%)",
            transform: "rotate(-12deg)",
            display: "flex",
            filter: "blur(4px)",
          }}
        />

        {/* Top-left glow */}
        <div
          style={{
            position: "absolute",
            top: "-150px",
            left: "-150px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0) 70%)",
            display: "flex",
          }}
        />

        {/* Bottom-right glow */}
        <div
          style={{
            position: "absolute",
            bottom: "-200px",
            right: "-200px",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(127, 29, 29, 0.35) 0%, rgba(127, 29, 29, 0) 70%)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 32,
            position: "relative",
            zIndex: 1,
            textAlign: "center",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 20,
              fontWeight: 600,
              color: "#ef4444",
              letterSpacing: "6px",
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 40,
                height: 2,
                background: "#ef4444",
                display: "flex",
              }}
            />
            Evil Touch
            <div
              style={{
                width: 40,
                height: 2,
                background: "#ef4444",
                display: "flex",
              }}
            />
          </div>

          {/* Heading */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 140,
                fontWeight: 900,
                letterSpacing: "-6px",
                lineHeight: 0.95,
                color: "#ffffff",
              }}
            >
              {siteConfig.name}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: "-2px",
                lineHeight: 1,
                background:
                  "linear-gradient(90deg, #ef4444 0%, #dc2626 50%, #7f1d1d 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {siteConfig.tagline}
            </div>
          </div>

          {/* Description */}
          <div
            style={{
              display: "flex",
              fontSize: 24,
              lineHeight: 1.5,
              color: "#a3a3a3",
              maxWidth: 760,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {siteConfig.description}
          </div>

          {/* Meta strip */}
          <div
            style={{
              display: "flex",
              gap: 24,
              fontSize: 18,
              color: "#737373",
              fontWeight: 500,
              letterSpacing: "1px",
              textTransform: "uppercase",
              marginTop: 20,
              paddingTop: 24,
              borderTop: "1px solid rgba(239, 68, 68, 0.2)",
              width: 600,
              justifyContent: "center",
            }}
          >
            <span>shadcn registry</span>
            <span style={{ color: "#ef4444" }}>•</span>
            <span>Motion</span>
            <span style={{ color: "#ef4444" }}>•</span>
            <span>TypeScript</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [
      {
        name: "Doto",
        data: await fetch(
          "https://fonts.gstatic.com/s/doto/v17/LDIbaomQNQcsA88c7O9yZ4KMCoOg4Ko.woff"
        ).then((res) => res.arrayBuffer()),
        weight: 900,
        style: "normal",
      },
    ] },
  );
}
