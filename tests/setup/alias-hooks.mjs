/*
  Resolve hook pre `node --test`: alias `@/` → `src/`, doplnenie prípony `.ts`
  a prázdne moduly pre `server-only` / `client-only` (v testoch nie sme v Reacte).
*/
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const src = path.join(root, "src");
const EMPTY_MODULE = "data:text/javascript,export {};";

function candidates(base) {
  return [base, `${base}.ts`, path.join(base, "index.ts")];
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: EMPTY_MODULE, shortCircuit: true };
  }

  let base = null;
  if (specifier.startsWith("@/")) {
    base = path.join(src, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (base) {
    for (const candidate of candidates(base)) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }

  return next(specifier, context);
}
