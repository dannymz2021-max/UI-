import test from 'node:test';
import assert from 'node:assert/strict';
import {providerConfig,providerPayload,validProviderSize,classifyProviderError,healthOwner} from '../server/providers.mjs';
import {generateArkImage} from '../server/ark-image.mjs';
import {previewSize,estimateArkCall} from '../server/creator-cost.mjs';
import {encodeRGBA,inspectPNG,placeTransparentLayer,composeTransparentLayers} from '../server/png.mjs';
function image(w,h,alpha=255){const pixels=Buffer.alloc(w*h*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=200;pixels[i+1]=40;pixels[i+2]=90;pixels[i+3]=alpha;}return encodeRGBA(w,h,pixels);}
const brief={background:'transparent',size:{width:1024,height:1024},subjects:['一个足球'],texts:[],preserve:[]};
const fail=(code,message,status)=>{throw Object.assign(new Error(message),{code,status});};
test('透明新图缺少费用授权时，底层也不先调用生图；尺寸和图层按实际输出估算',async()=>{
 let calls=0;
 await assert.rejects(()=>generateArkImage({brief,inputs:{references:[]},model:'m',prompt:'x',fail,request:async()=>{calls++;}}),e=>e.code==='PAID_EXTRACTION_REQUIRED');
 assert.equal(calls,0);assert.equal(previewSize(512,512).width,1024);
 const size=previewSize(1920,1080);assert.ok(size.width*size.height>=921600&&size.width*size.height<1100000);
 assert.equal(estimateArkCall('doubao-seedream-5-0-pro-260628',{layer_decomposition:true,image:'data',size:'auto'},{data:[{b64_json:'a',size:'1024x1024'},{b64_json:'b',size:'2048x2048'}]}),0.45);
 assert.equal(estimateArkCall('doubao-seedream-5-0-flash-260915',{size:'1024x1024'},{data:[{b64_json:'a'}]}),0.12);
});
test('豆包只读取自己的密钥和模型，需求理解使用支持的协议且不回退到OpenAI',()=>{
 const c=providerConfig({AI_PROVIDER:'ark',OPENAI_API_KEY:'other-key',ARK_API_KEY:'ark-test'});
 assert.equal(c.key,'ark-test');assert.ok(c.base.startsWith('https://ark.'));
 assert.equal(providerConfig({AI_PROVIDER:'ark',OPENAI_API_KEY:'other-key'}).key,undefined);
 const body=providerPayload(c,'responses',{instructions:'保留准确文字',model:'old-model',input:[{role:'user',content:[]}],text:{format:{type:'json_schema'}}});
 assert.equal(body.model,c.textModel);assert.equal(body.input[0].role,'system');assert.equal(body.thinking.type,'disabled');assert.equal(body.store,false);
 assert.equal(healthOwner('person','ark'),'ark:person');assert.notEqual(healthOwner('person','openai'),healthOwner('person','ark'));
});
test('豆包的开通、欠费、鉴权与限流错误分开处理；尺寸按Seedream规则验证',()=>{
 assert.equal(classifyProviderError(404,{error:{code:'ModelNotOpen'}}).code,'MODEL_NOT_ENABLED');
 assert.equal(classifyProviderError(403,{error:{code:'AccountOverdueError'}}).code,'QUOTA_EXCEEDED');
 assert.equal(classifyProviderError(429,{error:{code:'RateLimitExceeded'}}).code,'RATE_LIMITED');
 assert.equal(classifyProviderError(401,{error:{code:'AuthenticationError'}}).code,'INVALID_API_KEY');
 assert.equal(validProviderSize(1024,1024,'ark'),true);assert.equal(validProviderSize(512,512,'ark'),false);assert.equal(validProviderSize(4096,4096,'ark'),false);
});
test('新透明图经由生成与单一主体提取，依原坐标还原尺寸并保留Alpha',async()=>{
 const calls=[],full=image(1024,1024),layer=image(16,16,200);
 const r=await generateArkImage({brief,allowPaidExtraction:true,inputs:{references:[{dataUrl:'data:image/png;base64,reference'}]},model:'doubao-test',prompt:'一个足球',fail,request:async b=>{calls.push(b);return calls.length===1?{value:{data:[{b64_json:full.toString('base64')}],usage:{}},requestId:'a'}:{value:{data:[{z_index:0,size:'1024x1024'},{z_index:1,b64_json:layer.toString('base64'),bounding_box:{absolute:[256,256,768,768]},name:'主体'}],usage:{}},requestId:'b'};}});
 assert.equal(calls.length,2);assert.equal(calls[0].background,'opaque');assert.equal(calls[1].layer_decomposition,true);
 const v=inspectPNG(r.bytes,true);assert.equal(v.width,1024);assert.equal(v.pixels[3],0);assert.equal(v.pixels[(512*1024+512)*4+3],200);
 assert.ok(v.visiblePixels>0&&v.transparentPixels>0);assert.equal(r.requestId,'a / b');
});
test('已有透明基图只执行一次透明编辑；不会使用多图透明模式',async()=>{
 const base=image(1024,1024,180),calls=[];
 await generateArkImage({brief,inputs:{baseImage:'data:image/png;base64,'+base.toString('base64'),references:[]},model:'m',prompt:'换色',fail,request:async b=>{calls.push(b);return {value:{data:[{b64_json:base.toString('base64')}]}};}});
 assert.equal(calls.length,1);assert.equal(calls[0].background,'transparent');assert.equal(typeof calls[0].image,'string');
});
test('缺失图层文件和越界位置不冒充完整透明交付',async()=>{
 const full=image(1024,1024),layer=image(8,8,128);
 await assert.rejects(()=>generateArkImage({brief,allowPaidExtraction:true,inputs:{references:[]},model:'m',prompt:'x',fail,request:async b=>b.layer_decomposition?{value:{data:[{z_index:0,size:'1024x1024'},{z_index:1},{z_index:2}]}}:{value:{data:[{b64_json:full.toString('base64')}]}}}),e=>e.code==='LAYER_EXTRACTION_FAILED');
 assert.throws(()=>placeTransparentLayer(layer,32,32,[20,20,60,60]),/位置/);
 assert.throws(()=>placeTransparentLayer(layer,32,32,[0,0,32,4]),/比例/);
});
test('多个前景按照z顺序和原位置合成；重叠部分执行Alpha叠加并保留两侧主体',()=>{
 const red=Buffer.from([255,0,0,128]),blue=Buffer.from([0,0,255,128]);
 const r=composeTransparentLayers([{bytes:encodeRGBA(1,1,blue),box:[1,0,3,2],zIndex:2},{bytes:encodeRGBA(1,1,red),box:[0,0,2,2],zIndex:1}],4,4);
 const p=inspectPNG(r,true).pixels;
 assert.deepEqual([...p.subarray(0,4)],[255,0,0,128]);
 assert.ok(p[4+2]>p[4]);assert.ok(p[4+3]>128&&p[4+3]<255);
 assert.deepEqual([...p.subarray((3*4+3)*4,(3*4+3)*4+4)],[0,0,0,0]);
 assert.throws(()=>composeTransparentLayers([{bytes:r,box:[0,0,4,4],zIndex:1},{bytes:r,box:[0,0,4,4],zIndex:1}],4,4),/顺序/);
});
