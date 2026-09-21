import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = existsSync("dist/index.html") ? "dist" : "dist/client";
const index = join(dir, "index.html");
const html = readFileSync(index);
writeFileSync(index, Buffer.from(html.toString("utf8").replaceAll("\0", "")));
copyFileSync(index, join(dir, "404.html"));
writeFileSync(join(dir, ".nojekyll"), "");
console.log("pages dir:", dir);
console.log("pages:", readdirSync(dir).join(", "));
