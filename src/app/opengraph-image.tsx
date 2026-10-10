import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const alt =
  `${siteConfig.name}: Priprav sa na otázky, ktoré v pitch decku nie sú. Ukážka slidu so zvýrazneným číslom a otázkou investora.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [display, serif] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/bricolage-700.woff")),
  readFile(join(process.cwd(), "assets/fonts/source-serif-400.woff")),
]);

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 85% 10%, rgba(59,130,246,0.38), rgba(59,130,246,0.06) 45%, transparent 70%)",
          color: "#fafafa",
          fontFamily: "Bricolage",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="44" height="44" viewBox="0 0 28 28">
            <rect x="2" y="2" width="24" height="24" rx="7" fill="#27272a" />
            <rect x="9" y="9" width="10" height="10" rx="3" fill="#fafafa" />
          </svg>
          <span style={{ fontSize: 34, letterSpacing: "-0.02em" }}>{siteConfig.name}</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 84,
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
              maxWidth: 640,
            }}
          >
            <span>Priprav sa na otázky, ktoré v pitch decku nie sú.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: 400, gap: 16 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#e4e4e7",
                color: "#09090b",
                borderRadius: 10,
                padding: "22px 26px",
              }}
            >
              <span style={{ fontSize: 18, opacity: 0.55 }}>Trh a príležitosť</span>
              <div style={{ display: "flex", position: "relative", marginTop: 10 }}>
                <div
                  style={{
                    position: "absolute",
                    left: -6,
                    right: 110,
                    bottom: 6,
                    height: 26,
                    background: "#f5b942",
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 56, letterSpacing: "-0.03em" }}>4,2 mld. €</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                background: "#151518",
                border: "1px solid #27272a",
                borderRadius: 16,
                padding: "18px 22px",
                fontFamily: "Source Serif",
                fontSize: 26,
                lineHeight: 1.25,
              }}
            >
              Koľko z toho reálne oslovíte do troch rokov?
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: display, style: "normal", weight: 700 },
        { name: "Source Serif", data: serif, style: "normal", weight: 400 },
      ],
    },
  );
}
