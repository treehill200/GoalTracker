// Generates PWA icons from the original SVG logo. Run: npm run icons:generate
import sharp from "sharp";
import fs from "node:fs";

const out = "public/icons";
fs.mkdirSync(out, { recursive: true });
const logo = fs.readFileSync("scripts/icon.svg");
const maskable = fs.readFileSync("scripts/icon-maskable.svg");
const badge = fs.readFileSync("scripts/icon-badge.svg");

const jobs = [
  [logo, 192, `${out}/icon-192.png`],
  [logo, 512, `${out}/icon-512.png`],
  [maskable, 512, `${out}/maskable-512.png`],
  [maskable, 180, `${out}/apple-touch-icon.png`],
  [badge, 72, `${out}/badge-72.png`],
  [logo, 64, "app/icon.png"],
];
for (const [svg, size, file] of jobs) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
