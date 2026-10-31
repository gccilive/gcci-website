import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

// Host-agnostic TanStack Start config.
// SSR entry is redirected to src/server.ts (our error-page wrapper).
// nitro uses its default preset so the build runs on any Node host.
export default defineConfig({
  // Deployed under https://gcci.live/zenith/ (subfolder of a Laravel site).
  // This prefixes every built asset URL and drives the router basepath.
  // Change to "/" if you ever move the site to a domain/subdomain root.
  base: "/zenith/",
  css: { transformer: "lightningcss" },
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
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
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
  },
  server: {
    host: true,
    port: 8080,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      // Prerender every route to static HTML so the build output in
      // .output/public can be hosted on any static / shared host (no Node
      // runtime required). crawlLinks follows in-page <a> links; the explicit
      // pages list guarantees every route is generated even if unlinked.
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoSubfolderIndex: true,
        failOnError: false,
      },
      pages: [
        { path: "/", prerender: { enabled: true } },
        { path: "/agenda", prerender: { enabled: true } },
        { path: "/awards", prerender: { enabled: true } },
        { path: "/employment-zone", prerender: { enabled: true } },
        { path: "/podcast-room", prerender: { enabled: true } },
        { path: "/principals-conclave", prerender: { enabled: true } },
        { path: "/sponsors", prerender: { enabled: true } },
        { path: "/volunteers", prerender: { enabled: true } },
      ],
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro(),
    react(),
  ],
});
