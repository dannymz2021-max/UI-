import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {health,execute} from './driver.mjs';
import {relayPage} from './relay-page.mjs';
import {createBrowserJobs,extensionId,extensionOrigin} from './browser-jobs.mjs';
import {inputMedia} from './media.mjs';
export const SITE_ORIGIN='https://ui-studio-danny-rebuilt.voidgdszyy.chatgpt.site';
const origins=new Set([SITE_ORIGIN,'http://127.0.0.1:5173','http://127.0.0.1:9231',extensionOrigin]);
const idPattern=/^[a-zA-Z0-9_-]{20,80}$/;
const error=(code,message,status=400)=>Object.assign(Error(message),{code,status});
export function validateJob(body){
 if(!idPattern.test(body.requestId||''))throw error('INVALID_JOB','任务编号无效。');
 if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>12000)throw error('INVALID_PROMPT','请填写12000字以内的需求。');
 if(body.kind!==undefined&&!['image','ui-plan'].includes(body.kind))throw error('INVALID_JOB','不支持的创作类型。');
 let media;try{media=inputMedia(body);}catch(e){throw error('INVALID_REFERENCE',e.message);}
 const context=body.kind==='ui-plan'?{mode:['dark','light'].includes(body.context?.mode)?body.context.mode:'auto',width:[390,768,1440,1600].includes(body.context?.width)?body.context.width:'auto',previousPlan:body.context?.previousPlan&&JSON.stringify(body.context.previousPlan).length<35000?body.context.previousPlan:null}:null;
 return {id:body.requestId,prompt:body.prompt,kind:body.kind||'image',media,context,previousRequirements:body.previousRequirements?JSON.stringify(body.previousRequirements).slice(0,8000):null};
}
export async function createBridge({port=9231,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.sites-runtime/desktop-bridge'),driver={health,execute}}={}){
 await fs.mkdir(root,{recursive:true});const browserJobs=await createBrowserJobs(path.join(root,'inspiration'));const jobs=new Map(),tokens=new Map(),active=new Set();
 for(const name of await fs.readdir(root)){if(!/^[\w-]+\.json$/.test(name))continue;try{const j=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));if(!idPattern.test(j.id))continue;if(j.status==='running')j.status=j.submitAttempted?'unknown':'failed';jobs.set(j.id,j);}catch{}}
 const save=async j=>{await fs.writeFile(path.join(root,j.id+'.tmp'),JSON.stringify(j));await fs.rename(path.join(root,j.id+'.tmp'),path.join(root,j.id+'.json'));};
 const view=j=>({id:j.id,kind:j.kind||'image',status:j.status,transport:'desktop',createdAt:j.createdAt,prompt:j.prompt,model:j.kind==='ui-plan'?'豆包桌面 · 快速':'豆包桌面 · Seedream 4.5',plan:j.plan,references:(j.files||[]).map(({name,role,sha256,sourceURL})=>({name,role,sha256,sourceURL})),imageUrl:j.status==='succeeded'&&j.kind!=='ui-plan'?'/jobs/'+j.id+'/image':null,validation:j.validation,error:j.error,usage:{calls:[],estimatedImageCny:0,source:'desktop',note:'未调用付费API，免费额度以豆包客户端为准'}});
 const run=j=>{if(active.size)return;active.add(j.id);void(async()=>{try{j.error=null;const result=await driver.execute(j,save);if(j.kind==='ui-plan')j.plan=result.plan;else await fs.writeFile(path.join(root,j.id+'.png'),result);j.status='succeeded';await save(j);}catch(e){j.status=j.submitAttempted?'unknown':'failed';j.error={code:j.submitAttempted?'DESKTOP_UNKNOWN':'DESKTOP_NOT_SENT',message:e.message.split('\n')[0].replace(/^Error:\s*/,'')};await save(j);}finally{active.delete(j.id);}})();};
 const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   res.once('finish',()=>console.log(JSON.stringify({at:new Date().toISOString(),method:req.method,route:(req.url||'/').replace(/[a-zA-Z0-9_-]{20,}/g,':id'),origin:req.headers.origin||'local-navigation',status:res.statusCode})));
   if(req.headers.host!==`127.0.0.1:${server.address().port}`)throw error('HOST_NOT_ALLOWED','仅允许本机连接。',403);
   if(await browserJobs.extension(req,res))return;
   const navigation=new URL(req.url,'http://127.0.0.1');
   if(req.method==='GET'&&navigation.pathname==='/connect'&&!req.headers.origin){const opener=navigation.searchParams.get('origin'),nonce=navigation.searchParams.get('nonce');if(![SITE_ORIGIN,'http://127.0.0.1:5173'].includes(opener)||!/^[a-f0-9]{32}$/.test(nonce||''))throw error('PAIRING_INVALID','请从创作台重新打开连接窗口。',403);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"});res.end(relayPage(opener,nonce));return;}
   if(req.method==='GET'&&req.url==='/'&&!req.headers.origin){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'"});res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UI工作室 · 本机连接</title><style>body{font:16px/1.8 system-ui;background:#f6f4fb;color:#302b43;margin:64px auto;padding:24px;max-width:660px}main{background:white;border:1px solid #e5def3;border-radius:24px;padding:36px}h1{font-size:26px}p{color:#777}a{display:inline-block;background:#7352e8;color:white;text-decoration:none;border-radius:10px;padding:10px 20px}</style><main><h1>UI工作室 · 豆包桌面连接</h1><strong id="status">本机连接器已启动</strong><p>这个连接只在你的电脑运行。保持豆包登录并开启，在创作台点击「连接豆包桌面」。免费额度以豆包客户端为准。</p><a href="${SITE_ORIGIN}/studio/#creator">打开 AI创作台 →</a><p>支持文字生图、参考图、基图修改和 UI 需求生成。不会自动切换到付费 API，也不会购买套餐。</p></main><script>fetch('/health').then(r=>r.json()).then(v=>document.getElementById('status').textContent=v.connected?'豆包桌面已连接，可以回到创作台':'连接器已启动，请打开并登录豆包桌面端')</script></html>`);return;}
   if(req.method==='GET'&&req.url==='/health'&&!req.headers.origin){send(200,{ok:true,...await driver.health()});return;}
   const origin=req.headers.origin||(req.headers['x-uistudio-extension']===extensionId?extensionOrigin:null)||((req.headers['sec-fetch-site']==='same-origin'&&req.headers['x-uistudio-desktop']==='1')?'http://127.0.0.1:9231':null);if(!origins.has(origin))throw error('ORIGIN_NOT_ALLOWED','此网页没有连接权限。',403);
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-UIStudio-Desktop, X-UIStudio-Extension','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'300'});res.end();return;}
   if(req.headers['x-uistudio-desktop']!=='1')throw error('HEADER_REQUIRED','需要从创作台连接。',403);
   const url=new URL(req.url,'http://127.0.0.1');
   if(req.method==='GET'&&url.pathname==='/health'){send(200,{ok:true,...await driver.health()});return;}
   if(req.method==='POST'&&url.pathname==='/session'){const token=randomBytes(32).toString('hex');tokens.set(token,{origin,until:Date.now()+12*3600000});send(200,{ok:true,token,...await driver.health()});return;}
   const session=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));if(!session||session.origin!==origin||session.until<Date.now())throw error('CONNECT_REQUIRED','请点击“连接豆包桌面”。',401);
   if(await browserJobs.web(req,res,origin,url))return;
   const match=url.pathname.match(/^\/jobs\/([\w-]+)(\/image)?$/);
   if(req.method==='GET'&&match){const j=jobs.get(match[1]);if(!j||j.origin!==origin)throw error('JOB_NOT_FOUND','未找到此任务，连接器没有重新提交。',404);if(match[2]){if(j.status!=='succeeded')throw error('IMAGE_NOT_READY','图片尚未就绪。',409);const bytes=await fs.readFile(path.join(root,j.id+'.png'));res.writeHead(200,{'Content-Type':'image/png'});res.end(bytes);return;}send(200,{ok:true,job:view(j)});return;}
   if(req.method==='POST'&&url.pathname==='/resume'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000)throw error('TOO_LARGE','请求过大。',413);}const body=JSON.parse(raw),j=jobs.get(body.requestId);if(!j||j.origin!==origin)throw error('JOB_NOT_FOUND','未找到此任务。',404);if(j.status==='unknown'&&j.submitAttempted){j.status='running';await save(j);run(j);}send(200,{ok:true,job:view(j)});return;}
   if(req.method==='POST'&&url.pathname==='/abandon'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000)throw error('TOO_LARGE','请求过大。',413);}const body=JSON.parse(raw),j=jobs.get(body.requestId);if(!j||j.origin!==origin)throw error('JOB_NOT_FOUND','未找到此任务。',404);if(body.confirmedDesktopChecked!==true||active.has(j.id)||!['unknown','failed','succeeded'].includes(j.status))throw error('TASK_STILL_ACTIVE','请先检查豆包中的本次结果，处理中的任务暂不能结束等待。',409);if(j.status!=='succeeded')j.status='abandoned';await save(j);send(200,{ok:true,job:view(j)});return;}
   if(req.method==='POST'&&url.pathname==='/jobs'){
    if(!/^application\/json/.test(req.headers['content-type']||''))throw error('JSON_REQUIRED','请求格式无效。',415);
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>32*1024*1024)throw error('TOO_LARGE','参考图片总大小过大。',413);}const input=validateJob(JSON.parse(raw)),fingerprint=createHash('sha256').update(JSON.stringify({...input,media:input.media.map(({sha256,role,sourceURL})=>({sha256,role,sourceURL}))})).digest('hex'),existing=jobs.get(input.id);
    if(existing){if(existing.origin!==origin||existing.fingerprint!==fingerprint)throw error('JOB_CONFLICT','任务编号已被不同需求使用。',409);send(200,{ok:true,job:view(existing)});return;}
    if(active.size||[...jobs.values()].some(j=>['unknown','running'].includes(j.status)))throw error('DESKTOP_BUSY','上次桌面任务尚未确认，请先检查上次任务，避免重复生成。',409);
    const {media,...rest}=input,files=[];if(media.length){const folder=path.join(root,'references');await fs.mkdir(folder,{recursive:true});for(let i=0;i<media.length;i++){const m=media[i],filename=path.join(folder,input.id+'-reference-'+(i+1)+'.'+m.ext);await fs.writeFile(filename,m.bytes);files.push({path:filename,name:m.name,role:m.role,sha256:m.sha256,sourceURL:m.sourceURL});}}
    const j={...rest,files,origin,fingerprint,status:'running',createdAt:Date.now(),submitAttempted:false};jobs.set(j.id,j);await save(j);run(j);send(202,{ok:true,job:view(j)});return;
   }
   throw error('NOT_FOUND','未找到此操作。',404);
  }catch(e){send(e.status||500,{ok:false,error:{code:e.code||'BRIDGE_ERROR',message:e.status?e.message:'本机连接暂时不可用，请检查豆包桌面端。'}});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return {server,port:server.address().port,jobs};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {port}=await createBridge();console.log(`UI工作室桌面连接已启动：http://127.0.0.1:${port}（仅本机，未提交生成）`);}
