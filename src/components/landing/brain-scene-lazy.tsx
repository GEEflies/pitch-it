"use client";

import dynamic from "next/dynamic";

/* three.js sa načíta až na klientovi, aby neblokoval zvyšok stránky; placeholder drží rozmer (bez layout shiftu). */
export const BrainScene = dynamic(() => import("./brain-scene").then((m) => m.BrainScene), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true" style={{ width: "100%", height: "100%" }} />
  ),
});
