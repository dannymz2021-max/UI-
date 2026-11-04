import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {handleCreator} from '../server/creator.mjs';
import {inspectPNG} from '../server/png.mjs';
import {createHash} from 'node:crypto';
if(!process.argv.includes('--allow-paid-test')){console.log('未调用模型。真实验收需明确追加 --allow-paid-test；预览生图用 --generate，正式透明图另加 --final --allow-paid-extraction。');process.exit(0);}
const renderMode=process.argv.includes('--final')?'final':'preview',allowPaidExtraction=process.argv.includes('--allow-paid-extraction');
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
const reuseIndex=process.argv.indexOf('--resume-image');let reusedImage=null;
if(reuseIndex>=0){const file=fs.realpathSync(process.argv[reuseIndex+1]||'');const base=fs.realpathSync(root)+path.sep;if(!file.startsWith(base)||!file.endsWith('.png'))throw Error('只能复用验收目录内的PNG原图。');reusedImage=fs.readFileSync(file);const info=inspectPNG(reusedImage);if(info.width!==1024||info.height!==1024)throw Error('复用原图的尺寸不符。');console.log(JSON.stringify({stage:'resume_cached_original',file,sha256:createHash('sha256').update(reusedImage).digest('hex')}));}

const auditedFetch=async(...args)=>{if(reusedImage&&String(args[0]).endsWith('/images/generations')){const body=JSON.parse(args[1].body);if(!body.layer_decomposition&&body.background==='opaque'){const original=reusedImage;reusedImage=null;console.log(JSON.stringify({stage:'cached_generation_response',note:'复用先前真实返回的原图；本步骤未重新调用生图模型。'}));return Response.json({data:[{b64_json:original.toString('base64')}]},{headers:{'x-request-id':'cached-original'}});}}const r=await fetch(...args);if(r.ok&&String(args[0]).endsWith('/images/generations')){const v=await r.clone().json(),id=(r.headers.get('x-request-id')||r.headers.get('x-tt-logid')||crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,120);const images=(v.data||[]).slice(0,17).map((x,i)=>{const file=id+'-'+i+'.png';if(typeof x.b64_json==='string'&&x.b64_json.length<20000000)fs.writeFileSync(path.join(root,file),Buffer.from(x.b64_json,'base64'));return {file,z_index:x.z_index,size:x.size,bounding_box:x.bounding_box,name:x.name,description:x.description};});fs.writeFileSync(path.join(root,id+'.json'),JSON.stringify({model:v.model,images,usage:v.usage},null,2));console.log(JSON.stringify({stage:'image_response',requestId:id,images:images.map(({file,z_index,size,name})=>({file,z_index,size,name}))}));}if(!r.ok){let v={};try{v=await r.clone().json();}catch{}console.log(JSON.stringify({stage:'provider',status:r.status,code:v.error?.code,type:v.error?.type,message:String(v.error?.message||'').split(process.env.ARK_API_KEY).join('[redacted]').replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,'[image]').slice(0,1800),requestId:r.headers.get('x-request-id')||r.headers.get('x-tt-logid')}));}return r;};
const owner='ark-verification-'+crypto.randomUUID();
const call=async(route,body)=>{const req=new Request('http://127.0.0.1/api/creator/'+route,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':owner,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const r=await handleCreator(req,env,auditedFetch);return {status:r.status,...await r.json()};};
let inputs={renderMode,prompt:'参考图片只用于紫晶与黄金材质，生成一枚完整的足球Icon，1024×1024，居中并留出边距，透明背景。不要皇冠、金币、文字或水印。',references:[{role:'material',name:'紫晶材质参考',dataUrl:'data:image/png;base64,'+fs.readFileSync('public/studio/icon-samples/amethyst-crown.png').toString('base64')}]};
const brief=await call('interpret',inputs);console.log(JSON.stringify({stage:'interpretation',ok:brief.ok,status:brief.status,error:brief.error,brief:brief.brief,providerRequestId:brief.providerRequestId}));if(!brief.ok||brief.brief.clarification.length)process.exit(1);
if(!process.argv.includes('--generate'))process.exit(0);
const requestId=crypto.randomUUID(),generated=await call('generate',{...inputs,briefId:brief.briefId,requestId,allowPaidExtraction});console.log(JSON.stringify({stage:'generation',...generated}));if(generated.job?.status!=='succeeded')process.exit(1);
console.log(JSON.stringify({imagePath:path.join(root,requestId+'.png')}));
if(process.argv.includes('--edit')){
 const bytes=fs.readFileSync(path.join(root,requestId+'.png'));
 inputs={renderMode,prompt:'只把足球上的紫色宝石改成蓝色宝石，金色材质、足球结构、位置、大小和透明背景保持。1024×1024，不要文字或水印。',baseImage:'data:image/png;base64,'+bytes.toString('base64'),previousRequirements:brief.brief};
 const editedBrief=await call('interpret',inputs);console.log(JSON.stringify({stage:'edit_interpretation',ok:editedBrief.ok,status:editedBrief.status,error:editedBrief.error,clarification:editedBrief.brief?.clarification}));if(!editedBrief.ok||editedBrief.brief.clarification.length)process.exit(1);
 const editId=crypto.randomUUID(),edited=await call('generate',{...inputs,briefId:editedBrief.briefId,requestId:editId,allowPaidExtraction});console.log(JSON.stringify({stage:'edit',...edited}));if(edited.job?.status!=='succeeded')process.exit(1);
 console.log(JSON.stringify({editedImagePath:path.join(root,editId+'.png')}));
}
