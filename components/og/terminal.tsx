export interface TerminalProps {
  brand: string;
  title: string;
  caption?: string;
  accent?: string;
}

export const Terminal = ({ brand, title, caption, accent }: TerminalProps) => (
  <div
    style={{
      backgroundColor: "#000000",
      color: "#fafafa",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      justifyContent: "space-between",
      padding: "80px",
      width: "100%",
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        bottom: "-20%",
        right: "-20%",
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle, rgba(239, 68, 68, 0.6) 0%, rgba(185, 28, 28, 0.3) 25%, rgba(127, 29, 29, 0.12) 50%, transparent 70%)",
      }}
    />
    <div style={{ alignItems: "center", display: "flex", gap: "20px" }}>
      <div
        style={{
          backgroundColor: accent,
          borderRadius: "4px",
          height: "44px",
          width: "6px",
        }}
      />
      <div style={{ display: "flex", fontSize: "34px", fontWeight: 700 }}>
        {brand}
      </div>
    </div>

    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontSize: title.length > 28 ? 84 : 104,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {caption ? (
        <div
          style={{
            alignSelf: "flex-start",
            backgroundColor: "rgba(250,250,250,0.06)",
            border: "1px solid rgba(250,250,250,0.12)",
            borderRadius: "10px",
            color: accent,
            display: "flex",
            fontSize: "30px",
            fontWeight: 600,
            marginTop: "36px",
            padding: "12px 24px",
          }}
        >
          {caption}
        </div>
      ) : null}
    </div>
  </div>
);
