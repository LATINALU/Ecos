import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// La librería de mecánicas vive en el repo hermano Desktop\minialu (TypeScript puro, sin compilar).
const minialu = fileURLToPath(new URL("../minialu/lib/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: { alias: { minialu } },
  server: { fs: { allow: [".", "../minialu/lib"] } },
  test: { include: ["test/**/*.test.ts"] },
});
