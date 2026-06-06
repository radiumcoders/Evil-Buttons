import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 800,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          letterSpacing: -0.5,
        }}
      >
        EB
      </div>
    ),
    { ...size },
  );
}
