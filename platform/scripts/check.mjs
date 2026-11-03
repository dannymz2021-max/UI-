import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
const files=await fs.readdir(root,{recursive:true});
const missing=[];
let syntax=0,refs=0;
for(const file of files){
  const full=path.join(root,file);
  if(!(await fs.stat(full)).isFile())continue;
  if(/\.m?js$/.test(file)){
    const r=spawnSync(process.execPath,['--check',full],{encoding:'utf8'});
    assert.equal(r.status,0,`${file}: ${r.stderr}`);syntax++;
  }
  if(!/\.(html|css|js)$/.test(file)||/vendor[\\/]/.test(file))continue;
  const text=await fs.readFile(full,'utf8');
  const found=[...text.matchAll(/(?:src|href)=["']([^"']+)["']/g),...text.matchAll(/url\(["']?([^"')\s]+)["']?\)/g),...text.matchAll(/(?:from\s*|import\s*\()["'](\.\.?\/[^"']+)["']/g)];
  for(const match of found){
    const v=match[1];if(/^(https?:|data:|blob:|#|about:)/.test(v)||/[${}<>]/.test(v)||!v.includes('.'))continue;
    const target=path.resolve(v.startsWith('/')?root:path.dirname(full),'.'+(v.startsWith('/')?v:'/'+v).split(/[?#]/)[0]);
    refs++;
    try{await fs.access(target);}catch{missing.push({file,path:v});}
  }
}
const status=JSON.parse(await fs.readFile('dist/api/studio/status','utf8'));
assert.equal(status.generationReady,false);
assert.equal(status.uiReady,false);
assert.deepEqual(missing,[],'Missing static dependencies: '+JSON.stringify(missing));
console.log(JSON.stringify({syntaxChecked:syntax,assetReferences:refs,missing:missing.length,status:'passed'}));
