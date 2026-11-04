import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {health,execute} from './driver.mjs';
export const SITE_ORIGIN='https://ui-studio-danny-rebuilt.voidgdszyy.chatgpt.site';
const origins=new Set([SITE_ORIGIN,'http://127.0.0.1:5173']);
const idPattern=/^[a-zA-Z0-9_-]{20,80}$/;
const error=(code,message,status=400)=>Object.assign(Error(message),{code,status});
export function validateJob(body){
 if(!idPattern.test(body.requestId||''))throw error('INVALID_JOB','任务编号无效。');
 if(typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>12000)throw error('INVALID_PROMPT','请填写12000字以内的需求。');
 if(body.references?.length||body.baseImage)throw error('TEXT_ONLY','桌面自动连接目前支持文字生图。参考图和改图尚未接通，请移除后生成，或使用豆包手动导入。');
 return {id:body.requestId,prompt:body.prompt};
}
export async function createBridge({port=9231,root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.sites-runtime/desktop-bridge'),driver={health,execute}}={}){
 await fs.mkdir(root,{recursive:true});const jobs=new Map(),tokens=new Map(),active=new Set();
 for(const name of await fs.readdir(root)){if(!/^[\w-]+\.json$/.test(name))continue;try{const j=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));if(!idPattern.test(j.id))continue;if(j.status==='running')j.status=j.submitAttempted?'unknown':'failed';jobs.set(j.id,j);}catch{}}
 const save=async j=>{await fs.writeFile(path.join(root,j.id+'.tmp'),JSON.stringify(j));await fs.rename(path.join(root,j.id+'.tmp'),path.join(root,j.id+'.json'));};
 const view=j=>({id:j.id,status:j.status,transport:'desktop',createdAt:j.createdAt,prompt:j.prompt,model:'豆包桌面 · Seedream 4.5',imageUrl:j.status==='succeeded'?'/jobs/'+j.id+'/image':null,validation:j.validation,error:j.error,usage:{calls:[],estimatedImageCny:0,source:'desktop',note:'未调用付费API，免费额度以豆包客户端为准'}});
 const run=j=>{if(active.size)return;active.add(j.id);void(async()=>{try{j.error=null;const bytes=await driver.execute(j,save);await fs.writeFile(path.join(root,j.id+'.png'),bytes);j.status='succeeded';await save(j);}catch(e){j.status=j.submitAttempted?'unknown':'failed';j.error={code:j.submitAttempted?'DESKTOP_UNKNOWN':'DESKTOP_NOT_SENT',message:e.message.split('\n')[0].replace(/^Error:\s*/,'')};await save(j);}finally{active.delete(j.id);}})();};
 const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   if(req.headers.host!==`127.0.0.1:${server.address().port}`)throw error('HOST_NOT_ALLOWED','仅允许本机连接。',403);
   const origin=req.headers.origin;if(!origins.has(origin))throw error('ORIGIN_NOT_ALLOWED','此网页没有连接权限。',403);
   res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-UIStudio-Desktop','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'300'});res.end();return;}
   if(req.headers['x-uistudio-desktop']!=='1')throw error('HEADER_REQUIRED','需要从创作台连接。',403);
   const url=new URL(req.url,'http://127.0.0.1');
   if(req.method==='GET'&&url.pathname==='/health'){send(200,{ok:true,...await driver.health()});return;}
   if(req.method==='POST'&&url.pathname==='/session'){const token=randomBytes(32).toString('hex');tokens.set(token,{origin,until:Date.now()+12*3600000});send(200,{ok:true,token,...await driver.health()});return;}
   const session=tokens.get((req.headers.authorization||'').replace(/^Bearer /,''));if(!session||session.origin!==origin||session.until<Date.now())throw error('CONNECT_REQUIRED','请点击“连接豆包桌面”。',401);
   const match=url.pathname.match(/^\/jobs\/([\w-]+)(\/image)?$/);
   if(req.method==='GET'&&match){const j=jobs.get(match[1]);if(!j||j.origin!==origin)throw error('JOB_NOT_FOUND','未找到此任务，连接器没有重新提交。',404);if(match[2]){if(j.status!=='succeeded')throw error('IMAGE_NOT_READY','图片尚未就绪。',409);const bytes=await fs.readFile(path.join(root,j.id+'.png'));res.writeHead(200,{'Content-Type':'image/png'});res.end(bytes);return;}send(200,{ok:true,job:view(j)});return;}
   if(req.method==='POST'&&url.pathname==='/resume'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000)throw error('TOO_LARGE','请求过大。',413);}const body=JSON.parse(raw),j=jobs.get(body.requestId);if(!j||j.origin!==origin)throw error('JOB_NOT_FOUND','未找到此任务。',404);if(j.status==='unknown'&&j.submitAttempted){j.status='running';await save(j);run(j);}send(200,{ok:true,job:view(j)});return;}
   if(req.method==='POST'&&url.pathname==='/jobs'){
    if(!/^application\/json/.test(req.headers['content-type']||''))throw error('JSON_REQUIRED','请求格式无效。',415);
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>100000)throw error('TOO_LARGE','当前桌面连接仅支持文字需求。',413);}const input=validateJob(JSON.parse(raw)),fingerprint=createHash('sha256').update(input.prompt).digest('hex'),existing=jobs.get(input.id);
    if(existing){if(existing.origin!==origin||existing.fingerprint!==fingerprint)throw error('JOB_CONFLICT','任务编号已被不同需求使用。',409);send(200,{ok:true,job:view(existing)});return;}
    if(active.size||[...jobs.values()].some(j=>['unknown','running'].includes(j.status)))throw error('DESKTOP_BUSY','上次桌面任务尚未确认，请先检查上次任务，避免重复生成。',409);
    const j={...input,origin,fingerprint,status:'running',createdAt:Date.now(),submitAttempted:false};jobs.set(j.id,j);await save(j);run(j);send(202,{ok:true,job:view(j)});return;
   }
   throw error('NOT_FOUND','未找到此操作。',404);
  }catch(e){send(e.status||500,{ok:false,error:{code:e.code||'BRIDGE_ERROR',message:e.status?e.message:'本机连接暂时不可用，请检查豆包桌面端。'}});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return {server,port:server.address().port,jobs};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {port}=await createBridge();console.log(`UI工作室桌面连接已启动：http://127.0.0.1:${port}（仅本机，未提交生成）`);}
