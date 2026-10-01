import { ImageResponse } from "next/og";

export const alt = "Dossier: interview prep for any role, researched for you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0a0a0a",
          color: "#fafafa",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -520,
            top: -560,
            width: 1000,
            height: 1000,
            borderRadius: 9999,
            border: "2px solid rgba(251,65,40,0.7)",
            boxShadow: "0 0 120px 20px rgba(251,65,40,0.25)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -520,
            top: -560,
            width: 1000,
            height: 1000,
            borderRadius: 9999,
            border: "2px solid rgba(255,138,0,0.6)",
            boxShadow: "0 0 120px 20px rgba(255,138,0,0.2)",
          }}
        />
        <div style={{ fontSize: 28, color: "#fb4128", letterSpacing: 6, textTransform: "uppercase" }}>
          Dossier
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -3,
            textAlign: "center",
            lineHeight: 1.05,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span>Interview prep for any role,</span>
          <span style={{ color: "#fb4128" }}>researched for you.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 26, color: "#a1a1a1" }}>
          Roadmaps · Mock interviews · Resume Studio · Company kits
        </div>
      </div>
    ),
    size,
  );
}
