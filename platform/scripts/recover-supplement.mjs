import fs from 'node:fs/promises';
import path from 'node:path';
import {ICON_LOOKS} from '../dist/studio/icon-library-data.js';
const routes=new Set(ICON_LOOKS.map(x=>`/studio/icon-samples/${x.id}.png`));
for(const file of ['figma-main-page.js','figma-page.js']){
  const text=await fs.readFile('dist/studio/'+file,'utf8');
  for(const m of text.matchAll(/["'](\/[^"']+\.txt)["']/g))routes.add(m[1]);
}
const records=[];
for(const route of routes){
  const r=await fetch('https://layerlab-studio-dany.xpbet-3575.chatgpt.site'+route,{signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error(`${route}: ${r.status}`);
  const bytes=Buffer.from(await r.arrayBuffer());
  const full=path.resolve('dist','.'+route);
  await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,bytes);
  records.push({path:route,status:200,size:bytes.length});console.log(route);
}
const manifest=JSON.parse(await fs.readFile('recovery-manifest.json','utf8'));manifest.files.push(...records);
await fs.writeFile('recovery-manifest.json',JSON.stringify(manifest,null,2));
