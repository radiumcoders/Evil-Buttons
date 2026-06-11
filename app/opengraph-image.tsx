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
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "80px",
          background:
            "radial-gradient(ellipse at 15% 20%, rgba(220, 38, 38, 0.35) 0%, rgba(0, 0, 0, 0) 55%), radial-gradient(ellipse at 85% 85%, rgba(127, 29, 29, 0.55) 0%, rgba(0, 0, 0, 0) 60%), linear-gradient(135deg, #0a0000 0%, #050505 50%, #000000 100%)",
          color: "#fafafa",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Abstract glow orb */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "480px",
            height: "480px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0) 70%)",
            display: "flex",
          }}
        />

        {/* Subtle grid lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Top: logo + brand */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            position: "relative",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 32px rgba(220, 38, 38, 0.4)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.evilbuttons.com/logo.png"
              width="40"
              height="40"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.5px",
              color: "#e5e5e5",
            }}
          >
            {siteConfig.name}
          </div>
        </div>

        {/* Center: title + description */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            position: "relative",
            maxWidth: 1000,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 18,
                fontWeight: 500,
                color: "#ef4444",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 2,
                  background: "#ef4444",
                  display: "flex",
                }}
              />
              Evil Touch
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 88,
                fontWeight: 800,
                letterSpacing: "-3px",
                lineHeight: 1,
                background:
                  "linear-gradient(180deg, #ffffff 0%, #a3a3a3 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Animated Buttons
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 88,
                fontWeight: 800,
                letterSpacing: "-3px",
                lineHeight: 1,
                background:
                  "linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              With an Edge.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 26,
              lineHeight: 1.5,
              color: "#a3a3a3",
              maxWidth: 820,
            }}
          >
            A shadcn/ui registry of motion-powered buttons. Live previews,
            copy-paste docs, one-command installs.
          </div>
        </div>

        {/* Bottom: meta strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 28,
              fontSize: 20,
              color: "#737373",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#ef4444",
                  display: "flex",
                }}
              />
              shadcn registry
            </span>
            <span>Motion</span>
            <span>TypeScript</span>
            <span>Tailwind</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
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
