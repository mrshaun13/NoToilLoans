import { defineConfig } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Custom domain loans.toil404.com serves this project site at the root.
  base: "/",
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    viteReact(),
  ],
});
