import { writeFile } from 'node:fs/promises';
const response = await fetch('https://21st.dev/ascii-editor/demos/generated/ref-045.webp');
if (!response.ok || !response.headers.get('content-type')?.includes('image/webp')) throw new Error('Source image is unavailable.');
const bytes = new Uint8Array(await response.arrayBuffer());
if (String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') throw new Error('Invalid WebP source.');
await writeFile(new URL('../public/img/ref-045.webp', import.meta.url), bytes);
console.log(`Vendored Herbarium source (${bytes.length} bytes).`);
