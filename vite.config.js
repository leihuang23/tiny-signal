import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/signal.js",
      name: "TinySignal",
      fileName: "signal",
      formats: ["es"],
    },
  },
});
