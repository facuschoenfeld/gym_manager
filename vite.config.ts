/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Opciones de Vite pensadas para Tauri (solo aplican en `tauri dev` / `tauri build`)
  // 1. no ocultar los errores de Rust
  clearScreen: false,
  // 2. Tauri espera un puerto fijo: falla si está ocupado
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      // 3. no vigilar src-tauri
      ignored: ["**/src-tauri/**"],
    },
  },

  // Tests de lógica pura (sin DOM ni Tauri)
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
}));
