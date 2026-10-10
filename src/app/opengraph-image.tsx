import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const alt =
  `${siteConfig.name}: Priprav sa na otázky, ktoré v pitch decku nie sú. Ukážka slidu so zvýrazneným číslom a otázkou investora.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const display = await readFile(join(process.cwd(), "assets/fonts/bricolage-700.woff"));

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
          background: "#141414",
          backgroundImage:
            "radial-gradient(circle at 90% 0%, rgba(125,81,254,0.38), transparent 60%), radial-gradient(circle at 0% 20%, rgba(170,255,0,0.10), transparent 60%)",
          color: "#F5F5F7",
          fontFamily: "Bricolage",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="32" height="44" viewBox="-4 -4 216 292">
            <path
              d="M8 52C5 42 10 36 20 31L52 6C62 -1 72 0 82 4L158 41C190 57 212 90 205 126C202 146 193 158 185 165C183 149 178 140 168 134L12 58C10 57 9 55 8 52Z"
              fill="#AAFF00"
            />
            <path d="M73 100V214C73 232 64 242 50 250L9 281C5 284 2 282 2 278V140C2 128 8 120 18 114Z" fill="#7AB800" />
            <path d="M99 130L166 161L101 211Z" fill="#D2FF6B" stroke="#D2FF6B" strokeWidth="10" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 34, letterSpacing: "-0.03em", display: "flex" }}>
            Pitch<span style={{ color: "#AAFF00" }}>It</span>
          </span>
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
                background: "#F5F5F1",
                color: "#141414",
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
                    background: "#AAFF00",
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 56, letterSpacing: "-0.03em" }}>4,2 mld. €</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                background: "#1E1E22",
                border: "1px solid #333333",
                borderRadius: 16,
                padding: "18px 22px",
                fontFamily: "Bricolage",
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
      ],
    },
  );
}
