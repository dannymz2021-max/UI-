import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import {createBridge,SITE_ORIGIN,validateJob} from '../desktop/bridge.mjs';
import {composePrompt,downloadImage,canonicalText} from '../desktop/driver.mjs';
const headers={'Origin':SITE_ORIGIN,'X-UIStudio-Desktop':'1','Content-Type':'application/json'};
async function setup(driver){const root=await fs.mkdtemp(path.join(os.tmpdir(),'uistudio-desktop-'));const bridge=await createBridge({port:0,root,driver});const base='http://127.0.0.1:'+bridge.port;const call=(route,body,h={})=>fetch(base+route,{method:body?'POST':'GET',headers:{...headers,...h},body:body?JSON.stringify(body):undefined});const session=await(await call('/session',{})).json();return {...bridge,root,call:(route,body,h={})=>call(route,body,{Authorization:'Bearer '+session.token,...h}),async close(){await new Promise(r=>bridge.server.close(r));await fs.rm(root,{recursive:true,force:true});}};}
test('本机接口拒绝其他网页、缺少凭据和DNS重绑定；只放行指定来源',async()=>{
 const b=await setup({health:async()=>({connected:true}),execute:async()=>Buffer.from('x')});try{
  assert.equal((await b.call('/session',{}, {Origin:'https://evil.test'})).status,403);
  assert.equal((await b.call('/jobs',{}, {Authorization:''})).status,401);
  const rebound=await new Promise((resolve,reject)=>{const r=http.get({hostname:'127.0.0.1',port:b.port,path:'/health',headers:{...headers,Host:'evil.test'}},s=>{s.resume();resolve(s.statusCode);});r.on('error',reject);});assert.equal(rebound,403);
  const r=await fetch('http://127.0.0.1:'+b.port+'/jobs',{method:'OPTIONS',headers:{Origin:SITE_ORIGIN}});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),SITE_ORIGIN);assert.equal(r.headers.get('access-control-allow-private-network'),'true');
 }finally{await b.close();}
});
test('重复任务只发送一次；异步结果自动可读，不同需求不能占用同编号',async()=>{
 let calls=0,release;const gate=new Promise(r=>release=r);const b=await setup({health:async()=>({connected:true}),execute:async(j,save)=>{calls++;j.submitAttempted=true;await save(j);await gate;j.validation={width:1,height:1};return Buffer.from('test image');}});try{
  const body={requestId:crypto.randomUUID(),prompt:'紫晶足球 icon'};assert.equal((await b.call('/jobs',body)).status,202);assert.equal((await b.call('/jobs',body)).status,200);assert.equal(calls,1);
  assert.equal((await b.call('/jobs',{...body,prompt:'另一个需求'})).status,409);assert.equal((await b.call('/jobs',{requestId:crypto.randomUUID(),prompt:'新图'})).status,409);
  release();for(let n=0;n<40&&b.jobs.get(body.requestId).status!=='succeeded';n++)await new Promise(r=>setTimeout(r,10));
  const r=await(await b.call('/jobs/'+body.requestId)).json();assert.equal(r.job.status,'succeeded');assert.equal(r.job.usage.calls.length,0);assert.equal(r.job.usage.estimatedImageCny,0);assert.equal(await(await b.call(r.job.imageUrl)).text(),'test image');assert.equal(calls,1);
 }finally{release();await b.close();}
});
test('发送后连接中断进入未知状态，查询和重复提交均不重新生成',async()=>{
 let calls=0;const b=await setup({health:async()=>({connected:true}),execute:async(j,save)=>{calls++;j.submitAttempted=true;await save(j);throw Error('connection lost');}});try{
  const body={requestId:crypto.randomUUID(),prompt:'足球'};await b.call('/jobs',body);for(let n=0;n<30&&b.jobs.get(body.requestId).status==='running';n++)await new Promise(r=>setTimeout(r,10));
  assert.equal((await(await b.call('/jobs/'+body.requestId)).json()).job.status,'unknown');await b.call('/jobs',body);assert.equal(calls,1);const disk=JSON.parse(await fs.readFile(path.join(b.root,body.requestId+'.json'),'utf8'));assert.equal(disk.submitAttempted,true);
 }finally{await b.close();}
});
test('原始需求完整保留；不支持的参考图和改图在发送前拒绝',()=>{
 const prompt='不需要皇冠；准确文字：Bonjour；蓝色金属，16:9';assert.ok(composePrompt(prompt).includes(prompt));assert.throws(()=>validateJob({requestId:crypto.randomUUID(),prompt,references:[{dataUrl:'x'}]}),e=>e.code==='TEXT_ONLY');assert.throws(()=>validateJob({requestId:crypto.randomUUID(),prompt,baseImage:'x'}),e=>e.code==='TEXT_ONLY');
});
test('桌面富文本的段落换行不改变需求校验，准确文字中的空格仍要保留',()=>{assert.equal(canonicalText('一张图\n\n准确文字：A B'),canonicalText('一张图\n准确文字：A B'));assert.notEqual(canonicalText('准确文字：A B'),canonicalText('准确文字：AB'));});
test('原图下载只接受已观察的豆包媒体来源，不访问本机地址或重写缩略图URL',async()=>{
 let calls=0;for(const src of ['http://127.0.0.1/private','https://evil.test/a','https://p5-flow-imagex-sign.byteimg.com.evil.test/x'])await assert.rejects(()=>downloadImage({src,w:2048,h:2048},async()=>{calls++;}));assert.equal(calls,0);
});
