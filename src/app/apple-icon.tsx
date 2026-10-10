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
          background: "#0b1022",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 28 28">
          <path
            d="M5 4h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H11.5L6 24.5V20H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
            fill="#3d5bff"
          />
          <rect x="6" y="8.5" width="10" height="3.2" rx="1.6" fill="#ffc34d" />
          <rect x="6" y="13.6" width="14" height="2" rx="1" fill="#ffffff" fillOpacity="0.8" />
        </svg>
      </div>
    ),
    size,
  );
}
