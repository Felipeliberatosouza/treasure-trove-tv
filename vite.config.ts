import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(Date.now()),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/](docx|pptxgenjs|jspdf|html2canvas|jszip)[\\/]/.test(id)) return "vendor-docs";
          if (/[\\/](recharts|d3-[^\\/]+)[\\/]/.test(id)) return "vendor-charts";
          if (/[\\/]@supabase[\\/]/.test(id)) return "vendor-supabase";
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/](@radix-ui|lucide-react|sonner)[\\/]/.test(id)) return "vendor-ui";
        },
      },
    },
  },
}));
