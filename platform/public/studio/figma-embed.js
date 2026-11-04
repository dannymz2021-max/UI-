// Embed only files used by this composition. Cache bytes across repeated exports.
const cached=new Map();
function readDataURL(blob,mime){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('导出图片编码失败。'));reader.readAsDataURL(new Blob([blob],{type:mime}));});}
async function load(item){
  if(!cached.has(item.path))cached.set(item.path,(async()=>{
    const response=await fetch(item.path,{credentials:'same-origin'});
    if(!response.ok)throw new Error('无法打包原稿素材：'+item.path.split('/').pop());
    const blob=await response.blob();if(!blob.size)throw new Error('原稿素材为空，已停止导出。');
    return readDataURL(blob,item.mime);
  })().catch(error=>{cached.delete(item.path);throw error;}));
  return cached.get(item.path);
}
export async function embedFigmaAssets(manifest,body,css){
  const used=body+css,list=[...new Map([...manifest.assets,...manifest.fonts.map(f=>({...f,mime:'font/ttf'}))].filter(x=>used.includes(x.path)).map(x=>[x.path,x])).values()];
  let cursor=0;const result=new Map();
  await Promise.all(Array.from({length:Math.min(6,list.length)},async()=>{while(cursor<list.length){const item=list[cursor++];result.set(item.path,await load(item));}}));
  for(const [url,data] of result){body=body.split(url).join(data);css=css.split(url).join(data);}
  return {body,css};
}
