import fs from 'node:fs/promises';
import path from 'node:path';

const origin = 'https://layerlab-studio-dany.xpbet-3575.chatgpt.site';
const root = path.resolve('dist');
const queue = ['/studio/index.html'];
const seen = new Set();
const records = [];
const textExt = /\.(html?|css|m?js|json|svg|map|txt)$/i;
const assetExt = /\.(html?|css|m?js|json|svg|png|jpe?g|webp|gif|woff2?|ttf|otf|wasm|ico|txt|zip|hdr|glb)$/i;
const cleanHtml = s => s.replace(/<script>\(function\(\)\{function c\(\)[\s\S]*?<\/script>/g, '');

function enqueue(value, parent) {
  if (!value || /[${}<>\s]/.test(value) || /^(data:|blob:|https?:|#|javascript:)/i.test(value)) return;
  value = value.replace(/&amp;/g,'&').replace(/\\\//g,'/');
  let url; try { url = new URL(value, origin + parent); } catch { return; }
  if (url.origin !== origin || !assetExt.test(url.pathname) || url.pathname.startsWith('/cdn-cgi/')) return;
  if (!seen.has(url.pathname) && !queue.includes(url.pathname)) queue.push(url.pathname);
}

function discover(text, parent) {
  for (const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) enqueue(match[1],parent);
  for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) enqueue(match[1],parent);
  for (const match of text.matchAll(/["'`]([^"'`\r\n]+\.(?:html?|css|m?js|json|svg|png|jpe?g|webp|gif|woff2?|ttf|otf|wasm|ico|zip|hdr|glb)(?:\?[^"'`\s]*)?)["'`]/g)) enqueue(match[1],parent);
}

async function recover(route) {
  seen.add(route);
  const target = path.join(root, decodeURIComponent(route));
  if (!target.startsWith(root + path.sep)) throw Error('Unsafe asset path');
  try {
    const r = await fetch(origin + route, {signal: AbortSignal.timeout(35000)});
    if (!r.ok) { records.push({path:route,status:r.status}); return; }
    let bytes = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get('content-type') || '';
    if (!/\.html?$/i.test(route) && contentType.includes('text/html')) { records.push({path:route,status:'unexpected-html'}); return; }
    if (textExt.test(route)) {
      let text = bytes.toString('utf8');
      if (/\.html?$/i.test(route)) text = cleanHtml(text);
      bytes = Buffer.from(text);
      discover(text,route);
    }
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,bytes);
    records.push({path:route,status:200,size:bytes.length});
    console.log(`Saved ${route} (${bytes.length})`);
  } catch (e) { records.push({path:route,status:'failed',message:e.message}); console.log(`Failed ${route}: ${e.message}`); }
}

await fs.mkdir(root,{recursive:true});
while (queue.length) {
  const batch = queue.splice(0,6).filter(r=>!seen.has(r));
  await Promise.allSettled(batch.map(recover));
}
await fs.writeFile('recovery-manifest.json',JSON.stringify({origin,recoveredAt:new Date().toISOString(),files:records},null,2));
console.log(JSON.stringify({saved:records.filter(x=>x.status===200).length,failed:records.filter(x=>x.status!==200)}));
