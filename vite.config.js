import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH is set by the GitHub Pages workflow to "/<repo-name>/" so that
// asset URLs resolve under the project-pages sub-path. Locally it defaults to "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
