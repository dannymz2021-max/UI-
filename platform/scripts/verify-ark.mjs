import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {handleCreator} from '../server/creator.mjs';
const root=path.resolve('.sites-runtime/ark-verification');fs.mkdirSync(root,{recursive:true});
if(!process.env.ARK_API_KEY){console.log(JSON.stringify({ok:false,code:'NO_ARK_KEY'}));process.exit(1);}
const sql=new DatabaseSync(path.join(root,'verification.sqlite'));
for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()){
 const already=sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(file.startsWith('0000')?'creator_briefs':'creator_health');
 if(!already)sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
}
const DB={prepare(query){return {bind(...args){const statement=sql.prepare(query);return {async first(){return statement.get(...args)||null;},async run(){return {meta:{changes:Number(statement.run(...args).changes)}};}};}};}};
const BUCKET={async put(key,bytes){fs.writeFileSync(path.join(root,key.split('/').pop()),bytes);},async get(key){const file=path.join(root,key.split('/').pop());return fs.existsSync(file)?{body:fs.readFileSync(file)}:null;}};
const env={...process.env,AI_PROVIDER:'ark',DB,BUCKET,AI_DAILY_LIMIT:'3'};
const auditedFetch=async(...args)=>{const r=await fetch(...args);if(!r.ok){let v={};try{v=await r.clone().json();}catch{}console.log(JSON.stringify({stage:'provider',status:r.status,code:v.error?.code,type:v.error?.type,requestId:r.headers.get('x-request-id')||r.headers.get('x-tt-logid')}));}return r;};
const owner='ark-verification-'+crypto.randomUUID();
const call=async(route,body)=>{const req=new Request('http://127.0.0.1/api/creator/'+route,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':owner,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const r=await handleCreator(req,env,auditedFetch);return {status:r.status,...await r.json()};};
let inputs={prompt:'参考图片只用于紫晶与黄金材质，生成一枚完整的足球Icon，1024×1024，居中并留出边距，透明背景。不要皇冠、金币、文字或水印。',references:[{role:'material',name:'紫晶材质参考',dataUrl:'data:image/png;base64,'+fs.readFileSync('public/studio/icon-samples/amethyst-crown.png').toString('base64')}]};
const brief=await call('interpret',inputs);console.log(JSON.stringify({stage:'interpretation',ok:brief.ok,status:brief.status,error:brief.error,brief:brief.brief,providerRequestId:brief.providerRequestId}));if(!brief.ok||brief.brief.clarification.length)process.exit(1);
if(!process.argv.includes('--generate'))process.exit(0);
const requestId=crypto.randomUUID(),generated=await call('generate',{...inputs,briefId:brief.briefId,requestId});console.log(JSON.stringify({stage:'generation',...generated}));if(generated.job?.status!=='succeeded')process.exit(1);
console.log(JSON.stringify({imagePath:path.join(root,requestId+'.png')}));
if(process.argv.includes('--edit')){
 const bytes=fs.readFileSync(path.join(root,requestId+'.png'));
 inputs={prompt:'只把足球上的紫色宝石改成蓝色宝石，金色材质、足球结构、位置、大小和透明背景保持。1024×1024，不要文字或水印。',baseImage:'data:image/png;base64,'+bytes.toString('base64'),previousRequirements:brief.brief};
 const editedBrief=await call('interpret',inputs);console.log(JSON.stringify({stage:'edit_interpretation',ok:editedBrief.ok,status:editedBrief.status,error:editedBrief.error,clarification:editedBrief.brief?.clarification}));if(!editedBrief.ok||editedBrief.brief.clarification.length)process.exit(1);
 const editId=crypto.randomUUID(),edited=await call('generate',{...inputs,briefId:editedBrief.briefId,requestId:editId});console.log(JSON.stringify({stage:'edit',...edited}));if(edited.job?.status!=='succeeded')process.exit(1);
 console.log(JSON.stringify({editedImagePath:path.join(root,editId+'.png')}));
}
