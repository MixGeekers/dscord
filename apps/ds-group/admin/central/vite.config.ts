import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
// The central server serves this panel at /admin, next to its own /api.
export default defineConfig({
  root,
  base: "/admin/",
  publicDir: false,
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5175,
    proxy: {
      "/api": process.env.DSCORD_CENTRAL_URL || "http://127.0.0.1:18200",
    },
    fs: { allow: [path.join(root, "../..")] },
  },
  build: {
    outDir: "../../dist/central-admin",
    emptyOutDir: true,
    target: "es2022",
    license: { fileName: "licenses/bundled-dependencies.txt" },
  },
});
