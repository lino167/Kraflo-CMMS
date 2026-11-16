import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import type { Plugin } from "vite";
import { componentTagger } from "lovable-tagger";

// Injeta no service worker a lista de todos os arquivos do build (JS/CSS de cada tela),
// para o app abrir qualquer aba sem internet depois da primeira visita.
function precacheManifest(): Plugin {
  let outDir = "dist";
  let root = process.cwd();
  return {
    name: "kraflo-precache-manifest",
    apply: "build",
    configResolved(cfg) {
      outDir = cfg.build.outDir;
      root = cfg.root;
    },
    closeBundle() {
      const dir = path.resolve(root, outDir);
      const swPath = path.join(dir, "sw.js");
      if (!fs.existsSync(swPath)) return;
      const files: string[] = [];
      const walk = (d: string) => {
        for (const name of fs.readdirSync(d)) {
          const full = path.join(d, name);
          if (fs.statSync(full).isDirectory()) walk(full);
          else if (/\.(js|css|woff2?|svg|png|webmanifest)$/.test(name) && name !== "sw.js") {
            files.push("/" + path.relative(dir, full).split(path.sep).join("/"));
          }
        }
      };
      walk(dir);
      const sw = fs.readFileSync(swPath, "utf8");
      const version = Date.now().toString(36);
      fs.writeFileSync(
        swPath,
        sw
          .replace("'__PRECACHE__'", JSON.stringify(files))
          .replace("__BUILD_VERSION__", version),
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), precacheManifest()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
