import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  define: { __SHOWCASE__: JSON.stringify(mode === "showcase") },
  plugins: [react()],
  optimizeDeps: {
    include: [
      "three",
      "three/addons/loaders/GLTFLoader.js",
      "three/addons/controls/OrbitControls.js",
      "three/addons/geometries/RoundedBoxGeometry.js",
      "three/addons/geometries/DecalGeometry.js",
      "three/addons/environments/RoomEnvironment.js",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 3060,
    proxy: {
      "/api": {
        target: process.env.YENZE_API_URL || "http://127.0.0.1:3061",
        changeOrigin: false,
      },
    },
  },
  build: { chunkSizeWarningLimit: 800 },
}));
