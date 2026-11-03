import fs from 'node:fs/promises';
import path from 'node:path';
const key=process.env.OPENAI_API_KEY;
const matches=[];
for(const root of ['app','public','server','scripts','worker','lib','db','drizzle','.openai','dist']){
 try{for(const name of await fs.readdir(root,{recursive:true})){const file=path.join(root,name);if(!(await fs.stat(file)).isFile())continue;const b=await fs.readFile(file);if((key&&b.includes(Buffer.from(key)))||/sk-proj-[A-Za-z0-9_-]{50,}/.test(b.toString('utf8')))matches.push(file);}}
 catch(e){if(e.code!=='ENOENT')throw e;}
}
if(matches.length){console.error(JSON.stringify({secretScan:'failed',files:matches}));process.exit(1);}
console.log(JSON.stringify({secretScan:'passed',checkedSourceAndBuild:true}));
