import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/flexy-mini/",
  build: {
    // Keep route-heavy UI libraries out of the initial application chunk.
    // Stable shared chunks also improve repeat visits after small releases.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/@ant-design/icons/") || id.includes("/@ant-design/icons-svg/")) return "icons";
          if (id.includes("/@supabase/") || id.includes("/@refinedev/supabase/")) return "supabase";
        },
      },
    },
  },
});
