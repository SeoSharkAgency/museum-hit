import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/museum-hit/" : "/",
}));
