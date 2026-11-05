import fs from 'node:fs/promises';
import path from 'node:path';
const keys=[process.env.OPENAI_API_KEY,process.env.ARK_API_KEY].filter(Boolean);
const matches=[];
for(const root of ['app','public','server','desktop','tests','docs','scripts','worker','lib','db','drizzle','.openai','dist']){
 try{for(const name of await fs.readdir(root,{recursive:true})){const file=path.join(root,name);if(!(await fs.stat(file)).isFile())continue;const b=await fs.readFile(file);if(keys.some(key=>b.includes(Buffer.from(key)))||/sk-proj-[A-Za-z0-9_-]{50,}|ark-[a-f0-9-]{36}-[A-Za-z0-9_-]{10,}/i.test(b.toString('utf8')))matches.push(file);}}
 catch(e){if(e.code!=='ENOENT')throw e;}
}
if(matches.length){console.error(JSON.stringify({secretScan:'failed',files:matches}));process.exit(1);}
console.log(JSON.stringify({secretScan:'passed',checkedSourceAndBuild:true}));
