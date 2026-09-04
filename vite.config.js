import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// BASE_PATH is set by the GitHub Pages workflow to "/<repo-name>/" so that
// asset URLs resolve under the project-pages sub-path. Locally it defaults to "/".
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    // Installable, offline-capable app. The service worker is scoped to `base`,
    // so it only controls this app even when other project pages share the host.
    VitePWA({
      registerType: "autoUpdate",
      // Registration happens in src/main.jsx via virtual:pwa-register so the
      // page can reload itself when an update activates.
      injectRegister: null,
      manifest: {
        name: "Nestimate",
        short_name: "Nestimate",
        description: "Size up the nest egg. A browser-only retirement projection tool.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f4f6f7",
        theme_color: "#0f6b66",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        // Single-page app: serve the shell for any navigation under `base`.
        navigateFallback: base + "index.html",
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
