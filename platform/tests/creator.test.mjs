import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {deflateSync} from 'node:zlib';
import {handleCreator,validateSize,normalizeBrief,buildImageRequest,validateInputs,fingerprint} from '../server/creator.mjs';
import {inspectPNG} from '../server/png.mjs';

function crc(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);type.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([type,data])),data.length+8);return b;}
function png(width=1024,height=1024,alpha=true,empty=false){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const scan=Buffer.alloc((width*4+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const p=y*(width*4+1)+1+x*4;scan[p]=100;scan[p+1]=30;scan[p+2]=200;scan[p+3]=empty?0:alpha&&x<width/2?0:255;}return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);}
const rawPrompt='参考皇冠的材质生成一枚足球Icon，透明背景，不要皇冠或文字。';
function brief(){return {kind:'icon',summary:'一枚透明足球Icon',subjects:['一枚足球'],style:['精致商业质感'],materials:['参考图中的紫晶与黄金'],colors:[],composition:['主体完整居中'],texts:[],prohibitions:['皇冠','文字'],preserve:[],background:'transparent',size:{width:1024,height:1024,explicit:false},referenceRoles:[{index:0,role:'material',explanation:'仅迁移材质，不迁移皇冠主体。'}],clarification:[],providerPrompt:rawPrompt};}
function fixture(options={}){const db=new DatabaseSync(':memory:');for(const migration of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('drizzle/'+migration,'utf8'));const objects=new Map(),calls=[];
 const adapter={prepare(sql){return {bind(...args){const s=db.prepare(sql);return {async first(){return s.get(...args)||null;},async run(){const r=s.run(...args);return {meta:{changes:Number(r.changes)}};}};}};}};
 const env={OPENAI_API_KEY:'test-only-placeholder',AI_DAILY_LIMIT:'10',DB:adapter,BUCKET:{async put(k,v){objects.set(k,Buffer.from(v));},async get(k){return objects.has(k)?{body:objects.get(k)}:null;}},...options.env};
 const fetcher=async(url,init)=>{const payload=JSON.parse(init.body);calls.push({url,body:payload});if(options.reply)return options.reply(url,payload,calls);if(url.endsWith('/responses'))return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(options.brief||brief())}]}]},{headers:{'x-request-id':'req-interpret-test'}});if(options.error)return Response.json({error:{code:options.error}},{status:429,headers:{'x-request-id':'req-failed-test'}});return Response.json({data:[{b64_json:(options.image||png()).toString('base64')}],usage:{output_tokens:1}},{headers:{'x-request-id':'req-generate-test'}});};
 const request=(route,body,owner='owner-a',origin='https://studio.test')=>new Request('https://studio.test/api/creator/'+route,{method:body?'POST':'GET',headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),origin,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const call=async(route,body,owner,origin)=>{const r=await handleCreator(request(route,body,owner,origin),env,fetcher);return {status:r.status,body:await r.json()};};
 return {db,env,fetcher,request,call,calls,objects};}
async function planned(f,overrides={}){const input={prompt:rawPrompt,references:[],...overrides},result=await f.call('interpret',input);assert.equal(result.status,200);return {...input,briefId:result.body.briefId,requestId:crypto.randomUUID()};}

test('PNG检查依据实际像素，拒绝全透明空图和截断文件',()=>{const v=inspectPNG(png(16,16));assert.equal(v.transparentPixels,128);assert.equal(v.visiblePixels,128);assert.equal(inspectPNG(png(16,16,false)).transparentPixels,0);assert.throws(()=>inspectPNG(png(16,16,true,true)),/空图/);assert.throws(()=>inspectPNG(png().subarray(0,40)),/不完整/);});
test('明确的不支持尺寸保留原值并提出澄清，不偷偷缩放',async()=>{const inputs=await validateInputs({prompt:'1168×200横幅',references:[]}),value=brief();value.size={width:1168,height:200,explicit:true};const result=normalizeBrief(value,inputs);assert.equal(result.size.width,1168);assert.ok(result.clarification.length);assert.equal(validateSize(1024,1024),true);assert.equal(validateSize(1168,200),false);});
test('参考用途和原话进入实际编辑请求，基图先于参考图',async()=>{const image='data:image/png;base64,'+png(16,16).toString('base64'),inputs=await validateInputs({prompt:rawPrompt,references:[{dataUrl:image,role:'material'}],baseImage:image,previousRequirements:{prohibitions:['不要文字']}}),value=normalizeBrief(brief(),inputs),request=buildImageRequest(value,inputs);assert.equal(request.path,'images/edits');assert.equal(request.body.images.length,2);assert.ok(request.body.prompt.includes(rawPrompt));assert.ok(request.body.prompt.includes('仅用于material'));assert.ok(request.body.prompt.includes('不要文字'));});
test('没有身份或跨来源请求在调用模型前拒绝',async()=>{const f=fixture();assert.equal((await f.call('status',undefined,null)).status,401);assert.equal((await f.call('interpret',{prompt:rawPrompt},'owner-a','https://evil.test')).status,403);assert.equal(f.calls.length,0);});
test('未配置密钥返回真实状态，且不会调用模型',async()=>{const f=fixture();delete f.env.OPENAI_API_KEY;assert.equal((await f.call('status')).body.generationReady,false);const r=await f.call('interpret',{prompt:rawPrompt});assert.equal(r.body.error.code,'NOT_CONFIGURED');assert.equal(f.calls.length,0);});
test('真实SQL和对象存储流程：生成、文件读取和用户隔离',async()=>{const f=fixture(),body=await planned(f),r=await f.call('generate',body);assert.equal(r.body.job.status,'succeeded');assert.ok(r.body.job.validation.transparentPixels);assert.equal(r.body.job.validation.semanticReview,'needs_review');assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,1);const image=await handleCreator(f.request('jobs/'+body.requestId+'/image'),f.env,f.fetcher);assert.equal(image.headers.get('content-type'),'image/png');assert.ok((await image.arrayBuffer()).byteLength>100);assert.equal((await f.call('jobs/'+body.requestId,undefined,'owner-b')).status,404);});
test('重复提交同一任务不会再次调用收费模型',async()=>{const f=fixture(),body=await planned(f);const [a,b]=await Promise.all([f.call('generate',body),f.call('generate',body)]);assert.ok([200,202].includes(a.status));assert.ok([200,202].includes(b.status));await f.call('generate',body);assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,1);});
test('理解后修改参考图或原始文字必须重新整理',async()=>{const f=fixture(),body=await planned(f);assert.equal((await f.call('generate',{...body,prompt:'新的需求'})).body.error.code,'PROMPT_CHANGED');const other=await planned(f);assert.equal((await f.call('generate',{...other,references:[{dataUrl:'data:image/png;base64,'+png(16,16).toString('base64'),role:'style'}]})).body.error.code,'REFERENCE_CHANGED');assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,0);});
test('额度不足准确回传，不自动重试，也不覆盖原作品',async()=>{const f=fixture({error:'insufficient_quota'}),body=await planned(f),r=await f.call('generate',body);assert.equal(r.body.job.status,'failed');assert.equal(r.body.job.error.code,'QUOTA_EXCEEDED');assert.equal(f.objects.size,0);assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,1);});
test('credit_balance_exhausted不能误报为普通限流',async()=>{const f=fixture({error:'credit_balance_exhausted'}),r=await f.call('generate',await planned(f));assert.equal(r.body.job.error.code,'QUOTA_EXCEEDED');assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,1);});
test('生图欠费状态会保留，文字理解成功不会把生图错误清空',async()=>{
 const f=fixture({error:'AccountOverdueError',env:{AI_PROVIDER:'ark',ARK_API_KEY:'ark-test'}});
 await f.call('generate',await planned(f));
 assert.equal((await f.call('status')).body.lastError,'QUOTA_EXCEEDED');
 await planned(f);
 assert.equal((await f.call('status')).body.lastError,'QUOTA_EXCEEDED');
});
test('没有真实透明像素的结果不作为透明PNG交付',async()=>{const f=fixture({image:png(1024,1024,false)}),r=await f.call('generate',await planned(f));assert.equal(r.body.job.status,'failed');assert.equal(r.body.job.error.code,'ALPHA_MISSING');assert.equal(f.objects.size,0);});
test('24小时限制由服务端执行，客户端不能绕过',async()=>{const f=fixture();f.env.AI_DAILY_LIMIT='1';await f.call('generate',await planned(f));const r=await f.call('generate',await planned(f));assert.equal(r.status,429);assert.equal(r.body.error.code,'GENERATION_LIMIT');assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,1);});
test('指纹包含参考用途及上版要求，防止整理与生成上下文不一致',async()=>{const i=await validateInputs({prompt:rawPrompt}),a=await fingerprint(i);i.previousRequirements={prohibitions:['不要皇冠']};assert.notEqual(a,await fingerprint(i));});
test('切换豆包后不读取OpenAI的历史额度错误，并实际调用Ark的Responses和生图端点',async()=>{
 const b=brief();b.background='opaque';
 const f=fixture({env:{AI_PROVIDER:'ark',ARK_API_KEY:'ark-test-key'},brief:b,image:png(1024,1024,false)});
 const plan=await planned(f);assert.equal((await f.call('status')).body.provider,'ark');
 const result=await f.call('generate',plan);assert.equal(result.body.job.status,'succeeded');
 assert.ok(f.calls.every(x=>x.url.startsWith('https://ark.cn-beijing.volces.com/api/v3/')));
 assert.equal(f.calls[0].body.input[0].role,'system');assert.equal(f.calls[1].body.output_format,'png');
 assert.equal(f.calls[1].body.response_format,'b64_json');assert.equal(f.calls[1].body.background,'opaque');
});
test('UI 规划收到原始 PRD 和参考图；同用户重复请求受限，非法区块不会交给渲染器',async()=>{
 const output={family:'activity',mode:'dark',regions:['hero','steps'],gaps:[],title:'Bienvenido',subtitle:'',buttonLabel:'Ver más'};
 const valid=fixture({brief:output}),invalid=fixture({brief:{...output,regions:['hero','leagues']}});
 const req=()=>new Request('https://studio.test/api/studio/ui-plan',{method:'POST',headers:{'oai-authenticated-user-id':'owner-a',origin:'https://studio.test','content-type':'application/json'},body:JSON.stringify({prompt:'仅生成活动首屏和步骤',family:'activity',mode:'dark',referenceDataUrl:'data:image/png;base64,'+png(16,16).toString('base64')})});
 const good=await handleCreator(req(),valid.env,valid.fetcher);assert.equal(good.status,200);
 assert.equal((await good.json()).plan.copy.title,'Bienvenido');
 const sent=valid.calls[0].body.input[0].content;assert.ok(sent[0].text.includes('仅生成活动首屏和步骤'));assert.equal(sent[1].type,'input_image');
 assert.equal((await handleCreator(req(),valid.env,valid.fetcher)).status,429);assert.equal(valid.calls.length,1);
 const bad=await handleCreator(req(),invalid.env,invalid.fetcher);assert.equal(bad.status,502);assert.equal((await bad.json()).error.code,'UI_PLAN_INVALID');
});

test('默认抽卡使用Flash和约1K不透明预览，保留最终需求且只调用一次图片模型',async()=>{
 const b=brief();b.size={width:2048,height:2048,explicit:true};
 const f=fixture({env:{AI_PROVIDER:'ark',ARK_API_KEY:'ark-test'},brief:b,image:png(1024,1024,false)}),input=await planned(f);
 const saved=JSON.parse(f.db.prepare('SELECT brief_json FROM creator_briefs WHERE id=?').get(input.briefId).brief_json);
 assert.equal(saved.requestedOutput.background,'transparent');assert.equal(saved.requestedOutput.size.width,2048);
 assert.equal(saved.background,'opaque');assert.equal(saved.size.width,1024);assert.equal(saved.cost.maxImageCny,0.12);
 const result=await f.call('generate',{...input,allowPaidExtraction:true});
 assert.equal(result.body.job.status,'succeeded');assert.equal(result.body.job.usage.estimatedImageCny,0.12);
 const images=f.calls.filter(x=>x.url.includes('/images/'));assert.equal(images.length,1);
 assert.equal(images[0].body.model,'doubao-seedream-5-0-flash-260915');assert.equal(images[0].body.background,'opaque');assert.equal(images[0].body.layer_decomposition,undefined);
 // Another draw reuses the reviewed brief, with no second paid interpretation.
 await f.call('generate',{...input,requestId:crypto.randomUUID()});
 assert.equal(f.calls.filter(x=>x.url.endsWith('/responses')).length,1);assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,2);
});
test('正式透明输出未同意拆层费用时，服务端在任何生图请求之前拒绝',async()=>{
 const f=fixture({env:{AI_PROVIDER:'ark',ARK_API_KEY:'ark-test'}}),input=await planned(f,{renderMode:'final'}),r=await f.call('generate',input);
 assert.equal(r.body.error.code,'PAID_EXTRACTION_REQUIRED');assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,0);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM creator_jobs').get().n,0);
});
test('低价模型未开通时停止，不自动切换到Pro或重试',async()=>{
 const f=fixture({env:{AI_PROVIDER:'ark',ARK_API_KEY:'ark-test'},error:'ModelNotOpen'}),r=await f.call('generate',await planned(f));
 assert.equal(r.body.job.error.code,'MODEL_NOT_ENABLED');const images=f.calls.filter(x=>x.url.includes('/images/'));
 assert.equal(images.length,1);assert.equal(images[0].body.model,'doubao-seedream-5-0-flash-260915');
});
test('拆层失败仍保留先前成功生图的用量与费用估算，查询任务不会再扣费',async()=>{
 const f=fixture({env:{AI_PROVIDER:'ark',ARK_API_KEY:'ark-test'},reply:(url,payload)=>{
  if(url.endsWith('/responses'))return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(brief())}]}]});
  if(payload.layer_decomposition)return Response.json({error:{code:'InvalidParameter'}},{status:400,headers:{'x-request-id':'layer-failed'}});
  return Response.json({data:[{b64_json:png(1024,1024,false).toString('base64')}],usage:{generated_images:1}},{headers:{'x-request-id':'base-billable'}});
 }}),input=await planned(f,{renderMode:'final'}),r=await f.call('generate',{...input,allowPaidExtraction:true});
 assert.equal(r.body.job.status,'failed');assert.equal(r.body.job.usage.calls.length,1);assert.equal(r.body.job.usage.estimatedImageCny,0.30);
 assert.equal(r.body.job.usage.calls[0].requestId,'base-billable');assert.ok(r.body.job.providerRequestId.includes('layer-failed'));
 await f.call('jobs/'+input.requestId);assert.equal(f.calls.filter(x=>x.url.includes('/images/')).length,2);
});
