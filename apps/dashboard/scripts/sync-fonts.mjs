import path from "node:path";
import { fileURLToPath } from "node:url";
import { cpSync, existsSync, mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

const fontCopies = [
  {
    from: "node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2",
    to: "public/fonts/vazirmatn/vazirmatn-arabic-wght-normal.woff2",
  },
  {
    from: "node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-latin-ext-wght-normal.woff2",
    to: "public/fonts/vazirmatn/vazirmatn-latin-ext-wght-normal.woff2",
  },
  {
    from: "node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-latin-wght-normal.woff2",
    to: "public/fonts/vazirmatn/vazirmatn-latin-wght-normal.woff2",
  },
  {
    from: "node_modules/@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2",
    to: "public/fonts/inter/inter-latin-ext-wght-normal.woff2",
  },
  {
    from: "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    to: "public/fonts/inter/inter-latin-wght-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-ext-400-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-500-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-ext-500-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-600-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-ext-600-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-ext-700-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-500-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-600-normal.woff2",
  },
  {
    from: "node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2",
    to: "public/fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2",
  },
];

for (const entry of fontCopies) {
  const sourcePath = path.resolve(appRoot, entry.from);
  const targetPath = path.resolve(appRoot, entry.to);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing font source file: ${sourcePath}`);
  }
  mkdirSync(path.dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true });
}

console.log(`[dashboard:fonts] Synced ${fontCopies.length} font files to public/fonts.`);
