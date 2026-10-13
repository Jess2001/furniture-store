import { mkdir, readFile, writeFile } from "node:fs/promises";

const IMAGES_TS = "src/content/images.ts";
const OUT_DIR = "public/images";

const EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

async function download(url) {
  let lastStatus = "no response";
  for (const candidate of [`${url}=w2400`, url]) {
    try {
      const res = await fetch(candidate, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        const type = (res.headers.get("content-type") ?? "").split(";")[0];
        return {
          buffer: Buffer.from(await res.arrayBuffer()),
          ext: EXT[type] ?? "jpg",
        };
      }
      lastStatus = `HTTP ${res.status}`;
    } catch (error) {
      lastStatus = error.message;
    }
  }
  throw new Error(lastStatus);
}

const source = await readFile(IMAGES_TS, "utf8");
await mkdir(OUT_DIR, { recursive: true });

const urlPattern = /"(https:\/\/lh3\.googleusercontent\.com\/[^"]+)"/g;
const jobs = [];
let craftCount = 0;

for (const match of source.matchAll(urlPattern)) {
  const url = match[1];
  // the object key is the word just before the colon, e.g.  hero: "https://..."
  const before = source.slice(Math.max(0, match.index - 60), match.index);
  const key = before.match(/([\w-]+)["']?\s*:\s*$/)?.[1];
  const name = key ?? `craft-${++craftCount}`;
  jobs.push({ url, name });
}

let updated = source;
const failed = [];

for (const { url, name } of jobs) {
  process.stdout.write(`Downloading ${name} ... `);
  try {
    const { buffer, ext } = await download(url);
    const file = `${name}.${ext}`;
    await writeFile(`${OUT_DIR}/${file}`, buffer);
    updated = updated.split(`"${url}"`).join(`"/images/${file}"`);
    console.log(`${file} (${Math.round(buffer.length / 1024)} KB)`);
  } catch (error) {
    failed.push(name);
    console.log(`FAILED (${error.message})`);
  }
}

await writeFile(IMAGES_TS, updated);
console.log(
  `\nDone. ${jobs.length - failed.length} of ${jobs.length} images saved to ${OUT_DIR}.`,
);
if (failed.length) {
  console.log(
    `Still on Stitch links, need replacing by hand: ${failed.join(", ")}`,
  );
}
