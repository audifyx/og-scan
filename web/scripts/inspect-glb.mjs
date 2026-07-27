import fs from "node:fs";

const path = process.argv[2] || "public/orbitxcity/models/characters/Rogue.glb";
const buf = fs.readFileSync(path);
const s = buf.toString("latin1");
const names = [...s.matchAll(/"name"\s*:\s*"([^"]{2,60})"/g)].map((m) => m[1]);
const unique = [...new Set(names)];
const animLike = unique.filter((n) => /idle|walk|run|dance|jump|emote|wave|pose/i.test(n));
console.log(JSON.stringify({ path, animLike, sample: unique.slice(0, 80) }, null, 2));
