import {ownsMessages} from './message-scope.mjs';
import {imageRequirements} from './image-review.mjs';
// Only public, rendered controls in the user's explicitly connected desktop app.
// No cookies, account tokens, React state, private RPCs, or payment controls.
import {createHash} from 'node:crypto';
import {desktopPage} from './session.mjs';
import {inspectPNG} from '../server/png.mjs';
import {uiPlanningPrompt,extractUIJSON} from '../public/studio/ui-page-schema.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const hash=s=>createHash('sha256').update(s).digest('hex');
export const canonicalText=s=>s.replace(/\r\n/g,'\n').replace(/\n+/g,'\n').trim();
const visible=`e=>e.getClientRects().length&&e.getBoundingClientRect().width>0&&!e.closest('[aria-hidden="true"]')&&getComputedStyle(e).visibility!=='hidden'`;
const panelState=`(()=>{const p=document.querySelector('[data-testid="chat_input"]');if(!p)return null;const editors=[...p.querySelectorAll('textarea,[contenteditable="true"]')].filter(${visible});return {panel:p.innerText,editorCount:editors.length,draft:editors.map(e=>e.value||e.innerText||'').join(''),attachments:[...p.querySelectorAll('img')].filter(i=>i.naturalWidth>80&&i.getClientRects().length).length,busy:!!document.querySelector('[data-testid="chat_input_stop_button"]')}})()`;
async function imageReady(page){for(let n=0;n<30;n++){const s=await page.dom(panelState);if(s?.panel.includes('Seedream'))return s;await pause(300);}throw Error('豆包图像模式尚未加载完成，请稍后再试。');}
export async function health(){let page;try{page=await desktopPage();const state=await page.dom(panelState);return {connected:!!state,model:'Seedream 4.5',mode:'desktop',textOnly:false,uiPlanning:true};}catch{return {connected:false,model:'Seedream 4.5',mode:'desktop',textOnly:false,uiPlanning:true};}finally{page?.close();}}
async function click(page,selector,beforeClick){let point;for(let attempt=0;attempt<24;attempt++){point=await page.dom(`(()=>{let es=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(${visible});if(es.length>1&&${JSON.stringify(selector)}==='[data-testid="create_conversation_button"]')es=es.filter(e=>e.innerText.includes('新对话'));if(es.length!==1)return null;const e=es[0];if(e.disabled||e.getAttribute('aria-disabled')==='true')return null;const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(point)break;await pause(250);}if(!point)throw Error('豆包操作入口还未就绪，请保持主窗口可见后重试；本次没有点击发送。');await beforeClick?.();await page.call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await page.call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
async function chooseDailyModel(page){
 let s=await imageReady(page);if(!s?.panel.includes('Seedream 4.5')){
  // Inspect the currently rendered model button; don't use hidden application state.
  const selector=await page.dom(`(()=>{const p=document.querySelector('[data-testid="chat_input"]');const es=[...p.querySelectorAll('button,[role="button"],[data-testid]')].filter(${visible}).filter(e=>/Seedream/.test(e.innerText)&&e.innerText.length<60);const e=es.sort((a,b)=>a.innerText.length-b.innerText.length)[0];if(!e)throw Error('未找到生图模型入口。');e.setAttribute('data-uistudio-model-control','true');return '[data-uistudio-model-control="true"]'})()`);
  await click(page,selector);await pause(350);
  await page.dom(String.raw`(()=>{const es=[...document.querySelectorAll('div,button,[role="menuitem"]')].filter(${visible}).filter(e=>/^Seedream\s*4\.5\s*日常生成\s*$/.test(e.innerText.trim()));const e=es.sort((a,b)=>a.innerText.length-b.innerText.length)[0];if(!e)throw Error('免费日常模型入口已变化，请在豆包手动选择 Seedream 4.5。');e.setAttribute('data-uistudio-free-model','true');return true})()`);
  await click(page,'[data-uistudio-free-model="true"]');await pause(350);
 }
 s=await page.dom(panelState);if(!s?.panel.includes('Seedream 4.5')||!s.panel.includes('图像生成'))throw Error('未确认 Seedream 4.5 图像模式，已停止；不会改用付费 API。');
}
export function composePrompt(prompt,files=[],previousRequirements=null){return `请按以下原始需求生成一张图片。只生成一张，不使用需要付费或升级的功能。\n${files.length?'上传图片顺序与用途：'+files.map((f,i)=>`第${i+1}张：${({base:'修改基图，其余未要求修改的部分保持不变',auto:'按原始需求判断用途',subject:'只参考主体',style:'只参考风格',material:'只参考材质',color:'只参考颜色',composition:'只参考构图',general:'综合参考'})[f.role]}`).join('；')+'\n':''}${previousRequirements?'上一版需求记录（仅保留未被本次修改覆盖的要求）：'+previousRequirements+'\n':''}【原始需求】\n${prompt}\n【原始需求结束】\n如果需求不明确，请先在对话中询问，不要擅自添加主体。`;
}
async function uploadFiles(page,files){if(!files?.length)return;const document=await page.call('DOM.getDocument',{depth:1});let query=await page.call('DOM.querySelectorAll',{nodeId:document.root.nodeId,selector:'[data-testid="chat_input"] input[data-testid="upload-file-input"]'});if(query.nodeIds.length===0)query=await page.call('DOM.querySelectorAll',{nodeId:document.root.nodeId,selector:'[data-testid="chat_input"] input[type="file"][data-testid=""]'});if(query.nodeIds.length!==1)throw Error('豆包参考图上传入口已变化，未提交需求。');await page.call('DOM.setFileInputFiles',{nodeId:query.nodeIds[0],files:files.map(f=>f.path)});for(let n=0;n<50;n++){const state=await page.dom(panelState);if(state?.attachments>=files.length&&!/上传中|正在上传/.test(state.panel))return;await pause(400);}throw Error('参考图还未上传完成，请先在豆包检查；需求没有发送。');}
async function enterImage(page){
 const direct=await page.dom(`[...document.querySelectorAll('[data-testid="skill_bar_button_3"]')].filter(${visible}).length`);
 if(direct===1){await click(page,'[data-testid="skill_bar_button_3"]');return;}
 await click(page,'[data-testid="skill_bar_button_more"]');await pause(600);
 await page.dom(`(()=>{const es=[...document.querySelectorAll('[data-testid="chat_input"] button')].filter(${visible}).filter(e=>e.innerText.trim()==='图像生成');if(!es.length||es.length>1&&(!es[0].getAttribute('data-skill-panel-item-id')||es.some(e=>e.getAttribute('data-skill-panel-item-id')!==es[0].getAttribute('data-skill-panel-item-id'))))throw Error('技能菜单中未找到唯一的图像生成操作。');const e=es.find(e=>e.getAttribute('data-active')==='true')||es[0];e.setAttribute('data-uistudio-image-skill','true');return true})()`);
 await click(page,'[data-uistudio-image-skill="true"]');
}
export async function clearPreparedDraft(page,prompt){
 const owned=await page.dom(`(()=>{const p=document.querySelector('[data-testid="chat_input"]');const e=p?[...p.querySelectorAll('textarea,[contenteditable="true"]')].filter(${visible})[0]:null;const norm=${canonicalText.toString()};if(!e||norm(e.value??e.innerText??'')!==norm(${JSON.stringify(prompt)}))return false;e.focus();return true})()`);
 if(!owned)return false;
 await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});
 await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});return true;
}
export async function execute(job,save){
 const page=await desktopPage();try{
  if(!job.submitAttempted){
   await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   const state=await page.dom(panelState);if(!state||state.editorCount!==1)throw Error('请打开并登录豆包桌面端，保持主窗口可见。');if(state.draft.trim()||state.attachments)throw Error('豆包有未发送的草稿或图片，请先保存或处理；连接器没有覆盖它。');if(state.busy)throw Error('豆包正在处理其他任务，请完成后再试。');
   await page.call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await click(page,'[data-testid="create_conversation_button"]');await pause(700);
   let s=await page.dom(panelState);if(s?.draft.trim())throw Error('新对话内有草稿，已停止。');
   if(job.kind!=='ui-plan'){if(!s?.panel.includes('Seedream')){await enterImage(page);await pause(600);}await chooseDailyModel(page);}else{for(let n=0;n<20;n++){s=await page.dom(panelState);if(s?.panel.includes('快速')&&!s.panel.includes('Seedream'))break;await pause(300);}if(!s?.panel.includes('快速')||s.panel.includes('Seedream'))throw Error('请在豆包新对话选择免费“快速”模式，未提交 UI 需求。');}
   job.sentPrompt=job.kind==='ui-plan'?uiPlanningPrompt(job.prompt,{...job.context,hasReference:!!job.files?.length}):composePrompt(job.prompt,job.files,job.previousRequirements);
   await uploadFiles(page,job.files);
   job.baselineHashes=(await page.dom(`[...document.images].map(i=>i.currentSrc||i.src).filter(Boolean)`)).map(hash);
   await page.dom(`(()=>{const p=document.querySelector('[data-testid="chat_input"]');const es=[...p.querySelectorAll('textarea,[contenteditable="true"]')].filter(${visible});if(es.length!==1||(es[0].value||es[0].innerText||'').trim())throw Error('输入区已有内容，已停止。');es[0].focus();return true})()`);
   await page.call('Input.insertText',{text:job.sentPrompt});
   await page.dom(`(()=>{const p=document.querySelector('[data-testid="chat_input"]');const e=[...p.querySelectorAll('textarea,[contenteditable="true"]')].filter(${visible})[0];const norm=${canonicalText.toString()};if(norm(e?.value??e?.innerText??'')!==norm(${JSON.stringify(job.sentPrompt)})||!p.innerText.includes(${JSON.stringify(job.kind==='ui-plan'?'快速':'Seedream 4.5')}))throw Error('发送内容或免费模式发生变化，已停止。');return true})()`);
   // Durable write BEFORE the only send attempt. Restart/retry never sends again.
   await click(page,'[data-testid="chat_input_send_button"]',async()=>{job.submitAttempted=true;job.status='running';job.submittedAt=Date.now();await save(job);});await pause(1000);
   const location=await page.dom('location.href');job.conversation=location;await save(job);
  }
  const deadline=Date.now()+240000;let lastUIHash=null,routeSettling=0;
  while(Date.now()<deadline){
   const observation=await page.dom(String.raw`(()=>{const messages=[...document.querySelectorAll('[data-testid="send_message"]')];const norm=s=>s.replace(/\s/g,'');const own=(${ownsMessages.toString()})(messages.map(e=>e.innerText),${JSON.stringify(job.sentPrompt)},${job.files?.length||0});const p=document.querySelector('[data-testid="chat_input"]');return {location:location.href,own,reply:own?[...document.querySelectorAll('[data-testid="receive_message"] [data-testid="message_text_content"]')].map(e=>e.innerText).join('\n'):'',images:own?[...document.querySelectorAll('[data-testid="receive_message"] [data-testid="message_image_content"] img')].map(i=>({src:i.currentSrc||i.src,w:i.naturalWidth,h:i.naturalHeight,loaded:i.complete})).filter(i=>i.loaded&&i.w>=512&&i.h>=512&&/^https:\/\/p\d+-flow-imagex-sign\.byteimg\.com\//.test(i.src)):[],blocked:[...document.querySelectorAll('[role="dialog"]')].filter(${visible}).map(e=>e.innerText).some(t=>/付费|支付|额度不足|次数已用完|升级套餐|开通会员/.test(t)),busy:p?.innerText.includes('停止生成')||false}})()`);
   if(job.conversation&&observation.location!==job.conversation){const old=new URL(job.conversation),now=new URL(observation.location),promotion=old.protocol===now.protocol&&old.origin===now.origin&&old.host===now.host&&/^\/chat\/local_\d+$/.test(old.pathname)&&/^\/chat\/\d+$/.test(now.pathname);if(promotion&&observation.own){job.conversation=observation.location;await save(job);}else if(promotion&&routeSettling++<12){await pause(600);continue;}else throw Error('豆包对话已切换；保留原任务，不重新发送。请回到本次对话后检查任务。');}
   if(observation.blocked)throw Error('豆包提示额度或套餐限制，已停止；请在客户端查看免费额度，不会购买或调用付费 API。');
   if(job.kind==='ui-plan'){try{const plan=extractUIJSON(observation.reply),currentHash=hash(JSON.stringify(plan));if(lastUIHash===currentHash&&!observation.busy){job.status='succeeded';job.completedAt=Date.now();return {plan};}lastUIHash=currentHash;}catch{}await pause(1800);continue;}
   const images=[...new Map(observation.images.filter(i=>!job.baselineHashes.includes(hash(i.src))).map(i=>[i.src,i])).values()];
   if(images.length){
    if(images.length!==1)throw Error('豆包返回多张图片，无法唯一对应结果；请先在客户端检查，任务不会重发。');
    const image=await downloadImage(images[0]);job.validation={...image.validation,requirements:imageRequirements(job.prompt,job.previousRequirements,image.validation)};job.status='succeeded';job.completedAt=Date.now();return image.bytes;
   }
   await pause(1800);
  }
  throw Error('豆包尚未返回可下载图片。请查看客户端是否在询问需求或仍在生成，再点“检查上次任务”；不会重复发送。');
 }catch(e){if(!job.submitAttempted&&job.sentPrompt)await clearPreparedDraft(page,job.sentPrompt).catch(()=>{});throw e;}finally{page.close();}
}
export async function downloadImage(image,fetcher=fetch){
 const u=new URL(image.src);if(u.protocol!=='https:'||!/^p\d+-flow-imagex-sign\.byteimg\.com$/.test(u.hostname)||(u.port&&u.port!=='443')||u.username||u.password)throw Error('图片来源尚未验证，请在豆包手动下载。');
 const r=await fetcher(u,{signal:AbortSignal.timeout(60000),redirect:'error'});if(!r.ok)throw Error('原图下载暂时失败，请检查上次任务。');let size=0;const chunks=[];for await(const chunk of r.body){size+=chunk.length;if(size>24*1024*1024)throw Error('图片超过24MB，请在豆包下载。');chunks.push(chunk);}const bytes=Buffer.concat(chunks),validation=inspectPNG(bytes);
 if(validation.width!==image.w||validation.height!==image.h)throw Error('下载文件与桌面原图尺寸不一致，已停止。');return {bytes,validation:{...validation,source:'doubao-desktop',semanticReview:'needs_review'}};
}
