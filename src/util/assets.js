import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { config } from '../config.js';
import { STEPS, REVERT, REQUIREMENTS, REFERENCE, TROUBLE } from '../content/steps.js';

// Generate local raster placeholders without a build step or external image service.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}
function png(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * (width * 3 + 1) + 1 + x * 3;
    const glow = Math.max(0, 1 - Math.hypot(x / width - .55, y / height - .5) * 1.9);
    pixels[i] = Math.round(8 + glow * 75); pixels[i + 1] = Math.round(8 + glow * 8); pixels[i + 2] = Math.round(10 + glow * 12);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
export function ensureAssets() {
  const images = path.join(config.root, 'public/img');
  mkdirSync(images, { recursive: true });
  mkdirSync(path.join(config.root, 'public/audio'), { recursive: true });
  for (const [name, width, height] of [['banner.png', 1200, 400], ['og.png', 1200, 630]]) {
    const target = path.join(images, name);
    if (!existsSync(target)) writeFileSync(target, png(width, height));
  }
  const favicon = path.join(images, 'favicon.ico');
  if (!existsSync(favicon)) {
    const image = png(32, 32);
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header[6] = 32; header[7] = 32;
    header.writeUInt16LE(1, 10); header.writeUInt16LE(24, 12); header.writeUInt32LE(image.length, 14); header.writeUInt32LE(22, 18);
    writeFileSync(favicon, Buffer.concat([header, image]));
  }
  const tutorial = path.join(config.dataDir, 'downloads/tuto.md');
  // Keep the online and offline command blocks identical, including their backslashes.
  const text = `# FPS Unlocker (SEVEN Corporation) — Permanent License Bypass\n\nRun your own local auth server. Works offline while the server is running.\n\n> Windows 10/11 · app v1.0.0 · author-supplied test date 2026-10-23; not independently verified.\n\n## How it works\nThe guide redirects sevenauthapi.com locally, serves an HTTPS auth response, and supplies a forged token. Use only with permission.\n\n## Requirements\n${REQUIREMENTS.map(x => `- ${x}`).join('\n')}\n\n${STEPS.map(step => `## Step ${step.n} — ${step.title}\n${step.body}\n\n${step.cmd ? '```powershell\n' + step.cmd + '\n```\n' : ''}${step.note ? '> ' + step.note + '\n' : ''}`).join('\n')}\n## Verify\nOpen https://sevenauthapi.com/v1/test — JSON, no SSL error. This checks the local endpoint, not app compatibility.\n\n## Revert\nBack up hosts first. This supplied cleanup removes all matching domain entries/certificates, not just those created today. Stop the Python process with Ctrl+C.\n\n\`\`\`powershell\n${REVERT}\n\`\`\`\n\n## Technical reference\n${Object.entries(REFERENCE).map(([key, value]) => `- **${key}**: ${value}`).join('\n')}\n\n## Troubleshooting\n${TROUBLE.map(([symptom, fix]) => `- **${symptom}**: ${fix}`).join('\n')}\n\n## Caveats\n- Works only while fake.py runs; the generated expiry is ten years.\n- The SEVEN dashboard will not load while the hosts entry is active.\n- Do not use real account credentials.\n- The supplied server listens on all interfaces; keep it private.\n- Keep the private key in cert.pem secure, and revert certificate trust afterward.\n\n## License\nMIT applies to this website and guide, not the third-party executable.\n`;
  writeFileSync(tutorial, text);
}
