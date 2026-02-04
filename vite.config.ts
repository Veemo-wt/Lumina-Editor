import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    server: {
      port: 5173,
      host: "0.0.0.0",
      historyApiFallback: true, // SPA routing - always serve index.html
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },

    // ✅ this fixes "Top-level await is not available..."
    build: {
      target: "es2022", // or "esnext"
    },
    optimizeDeps: {
      esbuildOptions: {
        target: "es2022",
      },
    },
  };
});
