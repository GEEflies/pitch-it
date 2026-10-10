import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
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
          background: "#09090b",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 28 28">
          <rect x="2" y="2" width="24" height="24" rx="7" fill="#27272a" />
            <rect x="9" y="9" width="10" height="10" rx="3" fill="#fafafa" />
        </svg>
      </div>
    ),
    size,
  );
}
