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
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "72px",
          background:
            "radial-gradient(circle at 20% 20%, #2b2b2b 0%, #0a0a0a 45%), linear-gradient(135deg, #111 0%, #000 100%)",
          color: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              background: "#000",
              border: "4px solid #fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              color: "#fff",
            }}
          >
            EB
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>
              {siteConfig.name}
            </div>
            <div style={{ fontSize: 28, color: "#a3a3a3" }}>
              {siteConfig.tagline}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 30, lineHeight: 1.4, maxWidth: 900, color: "#d4d4d4" }}>
            {siteConfig.description}
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              fontSize: 22,
              color: "#737373",
            }}
          >
            <span>shadcn/ui registry</span>
            <span>•</span>
            <span>Motion animations</span>
            <span>•</span>
            <span>TypeScript + Tailwind</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
