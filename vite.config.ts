import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
const chunkGroups: Record<string, string[]> = {
  vendor: ['react', 'react-dom', 'react-router-dom'],
  ui: ['@radix-ui/react-accordion', '@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-tabs', 'lucide-react'],
  query: ['@tanstack/react-query'],
  supabase: ['@supabase/supabase-js'],
  charts: ['recharts'],
  utils: ['date-fns', 'zod', 'clsx', 'tailwind-merge'],
};

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          for (const [chunk, packages] of Object.entries(chunkGroups)) {
            if (packages.some(packageName => id.includes(`/node_modules/${packageName}/`))) {
              return chunk;
            }
          }
          return undefined;
        },
      }
    }
  }
});
