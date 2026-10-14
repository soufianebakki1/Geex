import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const proxyTarget = env.API_PROXY_TARGET;

  return {
    root: __dirname,
    plugins: [react()],
    server: {
      port: 5173,
      open: "/",
      proxy: proxyTarget
        ? { "/api": { target: proxyTarget, changeOrigin: true } }
        : undefined,
    },
    build: {
      outDir: path.join(__dirname, "dist"),
      emptyOutDir: true,
    },
  };
});
