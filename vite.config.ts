import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { copyFileSync, mkdirSync } from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: "copy-pwa-files",
      apply: "build",
      enforce: "post",
      generateBundle() {
        const files = ["manifest.json", "service-worker.js", "icon-192.png", "icon-512.png"];
        mkdirSync("dist", { recursive: true });
        files.forEach((file) => {
          try {
            copyFileSync(`public/${file}`, `dist/${file}`);
          } catch (e) {
            console.warn(`Could not copy ${file}`);
          }
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
