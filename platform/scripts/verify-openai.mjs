import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {handleCreator,IMAGE_MODEL,TEXT_MODEL} from '../server/creator.mjs';

const root=path.resolve('.sites-runtime/ai-verification');fs.mkdirSync(root,{recursive:true});
if(!process.env.OPENAI_API_KEY){console.log(JSON.stringify({ok:false,code:'NO_KEY',message:'未配置本地密钥。'}));process.exit(1);}
const sql=new DatabaseSync(path.join(root,'verification.sqlite'));
if(!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creator_briefs'").get())sql.exec(fs.readFileSync('drizzle/0000_sour_sharon_carter.sql','utf8'));
if(!sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creator_health'").get())sql.exec(fs.readFileSync('drizzle/0001_mean_katie_power.sql','utf8'));
const adapter={prepare(query){return {bind(...args){const statement=sql.prepare(query);return {async first(){return statement.get(...args)||null;},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};}};}};}};
const bucket={async put(key,bytes){fs.writeFileSync(path.join(root,key.split('/').pop()),bytes);},async get(key){const file=path.join(root,key.split('/').pop());return fs.existsSync(file)?{body:fs.readFileSync(file)}:null;}};
const env={...process.env,DB:adapter,BUCKET:bucket,AI_DAILY_LIMIT:'2'};
const reportPath=path.join(root,'report.json');
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{};
const auditedFetch=async(...args)=>{const r=await fetch(...args);if(!r.ok){let b={};try{b=await r.clone().json();}catch{}const message=String(b.error?.message||'');console.log(JSON.stringify({stage:'provider_diagnostic',status:r.status,code:b.error?.code,type:b.error?.type,quotaLanguage:/current quota|billing quota|run out of credits|no balance|exceeded.*quota/i.test(message),rateLanguage:/rate limit|per minute|tokens per/i.test(message),retryAfter:r.headers.get('retry-after'),limitRequests:r.headers.get('x-ratelimit-limit-requests'),limitTokens:r.headers.get('x-ratelimit-limit-tokens'),requestId:r.headers.get('x-request-id')}));}return r;};
const call=async(route,body)=>{const request=new Request('http://127.0.0.1/api/creator/'+route,{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':'local-api-verification','content-type':'application/json'},body:body?JSON.stringify(body):undefined});const response=await handleCreator(request,env,auditedFetch);return {status:response.status,...await response.json()};};
for(const model of [TEXT_MODEL,IMAGE_MODEL]){
 try{const response=await fetch('https://api.openai.com/v1/models/'+model,{headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},signal:AbortSignal.timeout(20000)});let body={};try{body=await response.json();}catch{}console.log(JSON.stringify({stage:'model_access',model,status:response.status,code:body.error?.code||null}));if(!response.ok)process.exit(1);}catch{console.log(JSON.stringify({stage:'model_access',ok:false,code:'NETWORK_ERROR'}));process.exit(1);}
}
if(!report.briefId){
 const reference=fs.readFileSync('public/studio/icon-samples/amethyst-crown.png').toString('base64');
 report.input={prompt:'只参考皇冠的紫晶与黄金材质，生成一枚精致的足球Icon。1024×1024，主体完整居中，透明背景。不要皇冠、金币、文字、水印或其他装饰。',references:[{name:'材质参考',role:'material',dataUrl:'data:image/png;base64,'+reference}]};
 const result=await call('interpret',report.input);report.interpretation=result;
 if(result.ok){report.briefId=result.briefId;report.requestId=crypto.randomUUID();}
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
 console.log(JSON.stringify({stage:'interpretation',ok:result.ok,status:result.status,error:result.error,brief:result.brief,providerRequestId:result.providerRequestId}));
 if(!result.ok)process.exit(1);
}
if(process.argv.includes('--generate')){
 const result=await call('generate',{...report.input,briefId:report.briefId,requestId:report.requestId,quality:'low'});report.generation=result;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({stage:'generation',...result}));if(result.job?.status!=='succeeded')process.exit(1);
 console.log(JSON.stringify({verifiedImage:path.join(root,report.requestId+'.png')}));
}
