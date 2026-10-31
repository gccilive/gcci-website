// One-time asset fetcher.
//
// The images/video used by this app were originally stored in Lovable's cloud
// and referenced as `/__l5e/assets-v1/<id>/<file>` pointers. This script pulls
// the real binaries down into `src/assets/` so the project is fully self-hosted.
//
// Usage:
//   node scripts/download-assets.mjs
//   LOVABLE_PREVIEW_HOST=<your-host> node scripts/download-assets.mjs   (override host)
//
// After it finishes successfully you can delete this script — the files in
// src/assets/ are all the app needs.

import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST =
  process.env.LOVABLE_PREVIEW_HOST?.trim() ||
  "id-preview-47a2b83a--89648609-85ba-4cb6-87dc-0ed47dea8cdb.lovable.app";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../src/assets");

// filename -> Lovable asset id
const ASSETS = {
  "ai-week.jpg": "6c11d9fc-5295-4913-a2b8-273e84ccbf45",
  "cyber-week.jpg": "cce38c58-381a-40b1-aca2-377354cef914",
  "fragments-night.jpg": "253a8de5-7a64-456b-8c9a-456d62a13d51",
  "gala-dj.jpg": "6382b2b3-9672-487e-83c8-1ff91ca0abce",
  "gcci-logo.webp": "c36c5bb6-8db4-4675-9e1f-c8598d69e588",
  "golden-book.mp4": "abd495d3-f228-4cdb-8492-36de5cfc6f7e",
  "gov-logo-1.jpg": "b6dcaff7-17e8-48c9-b52f-ffbeb87eab2d",
  "gov-logo-2.jpg": "de12d332-d3f2-4806-b3d8-72f8960f1d29",
  "gov-logo-3.jpg": "b66b0bfa-6ab6-40b6-b62a-0c518c251260",
  "gov-logo-4.jpg": "4919217f-c2f4-4b81-80d4-ef6cdcffa20d",
  "gov-logo-5.jpg": "de9ee9e9-febd-4222-b3a3-04eacb4cfb62",
  "gov-logo-6.jpg": "556adf60-5248-4289-95b2-c10030ee04cc",
  "gov-logo-7.jpg": "cf06c2a0-a077-49dd-a838-99fd966571fd",
  "musical-night.jpg": "324b939e-3508-4c4b-a882-6ef5eafc0989",
  "tech-sectors-v2.png": "1ad3c575-fe3e-404f-a6f6-f3ffa8b32037",
};

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          if (redirects > 5) return reject(new Error("too many redirects"));
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          return resolve(download(next, dest, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Downloading ${Object.keys(ASSETS).length} assets from ${HOST}\n`);

  let failed = 0;
  for (const [filename, id] of Object.entries(ASSETS)) {
    const url = `https://${HOST}/__l5e/assets-v1/${id}/${filename}`;
    const dest = path.join(OUT_DIR, filename);
    try {
      await download(url, dest);
      const kb = (fs.statSync(dest).size / 1024).toFixed(0);
      console.log(`  ok   ${filename} (${kb} KB)`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${filename} — ${err.message}`);
    }
  }

  console.log("");
  if (failed) {
    console.error(
      `${failed} file(s) failed. If the preview host is offline, drop the ` +
        `originals into src/assets/ manually (same filenames), or pass a ` +
        `working host via LOVABLE_PREVIEW_HOST.`,
    );
    process.exit(1);
  }
  console.log("All assets downloaded to src/assets/. You can delete this script now.");
}

main();
