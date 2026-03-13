import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, rgba(82,124,116,1) 0%, rgba(139,169,187,1) 100%)",
          color: "#fffdfa",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: "-0.06em",
        }}
      >
        RE
      </div>
    ),
    {
      ...size,
    }
  );
}
