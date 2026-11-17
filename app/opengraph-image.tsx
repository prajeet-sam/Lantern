import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Moonlit Garden — a private space for your rhythm";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ background: "#211b2c", color: "#ece7f7", display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px", width: "100%", height: "100%" }}>
      <div style={{ color: "#e6b06a", fontSize: 28, letterSpacing: 6 }}>MOONLIT GARDEN</div>
      <div style={{ fontSize: 72, fontWeight: 600, marginTop: 24 }}>A private space for<br />your rhythm.</div>
      <div style={{ color: "#b79ae8", fontSize: 28, marginTop: 28 }}>Understand your cycle. Notice your patterns. Be gentle with yourself.</div>
    </div>,
    { ...size },
  );
}
