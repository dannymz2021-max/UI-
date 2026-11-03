import { ICON_LOOKS } from './icon-library-data.js';
const grid=document.querySelector('#icon-grid'),status=document.querySelector('#collection-status');
const label={casino:'CASINO',rewards:'REWARDS',sports:'SPORTS'};
let loaded=0,failed=0;
const updateStatus=()=>status.textContent=failed?`${loaded} 款已就绪 · ${failed} 款图片未载入，请刷新重试`:`${loaded} / ${ICON_LOOKS.length} 款图标已就绪`;
for(const [index,look] of ICON_LOOKS.entries()){
  const card=document.createElement('article');card.className='icon-card';card.dataset.category=look.category;
  const art=document.createElement('a');art.className='icon-card-art';art.href=`./index.html?sample=${encodeURIComponent(look.id)}#icons`;art.setAttribute('aria-label',`在工作台编辑${look.title}`);
  const serial=document.createElement('span');serial.className='icon-card-number';serial.textContent=String(index+1).padStart(2,'0');
  const tag=document.createElement('span');tag.className='icon-card-kind';tag.textContent=label[look.category];
  const img=new Image();img.alt=look.title+'，透明背景 3D 图标';img.width=512;img.height=512;img.decoding='async';img.loading=index<8?'eager':'lazy';
  const content=document.createElement('div');content.className='icon-card-content';
  const title=document.createElement('h2');title.textContent=look.title;
  const description=document.createElement('p');description.textContent=look.description;
  const actions=document.createElement('div');actions.className='icon-card-actions';
  const edit=document.createElement('a');edit.className='icon-card-edit';edit.href=art.href;edit.textContent='使用这款 ↗';
  const download=document.createElement('a');download.className='icon-card-download';download.textContent='透明 PNG ↓';download.setAttribute('aria-disabled','true');
  const imagePath=`./icon-samples/${look.id}.png`;
  img.onload=()=>{loaded++;download.href=imagePath;download.download=`UIStudio-${look.id}-512.png`;download.removeAttribute('aria-disabled');updateStatus();};
  img.onerror=()=>{failed++;img.alt=look.title+'图片未能载入，可进入工作台生成';updateStatus();};img.src=imagePath;
  art.append(serial,tag,img);actions.append(edit,download);content.append(title,description,actions);card.append(art,content);grid.append(card);
}
document.querySelectorAll('[data-category]').forEach(button=>{if(button.tagName!=='BUTTON')return;button.addEventListener('click',()=>{
  document.querySelectorAll('.collection-filters button').forEach(other=>{const selected=other===button;other.classList.toggle('selected',selected);other.setAttribute('aria-pressed',String(selected));});
  for(const card of grid.children)card.hidden=button.dataset.category!=='all'&&card.dataset.category!==button.dataset.category;
});});
