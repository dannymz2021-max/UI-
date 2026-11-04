import {inspectPNG,placeTransparentLayer} from './png.mjs';

export async function generateArkImage({brief,inputs,model,prompt,request,fail}){
 const images=[...(inputs.baseImage?[inputs.baseImage]:[]),...inputs.references.map(x=>x.dataUrl)];
 let directAlpha=false;
 if(brief.background==='transparent'&&inputs.baseImage&&!inputs.references.length){
  try{directAlpha=inspectPNG(Buffer.from(inputs.baseImage.split(',')[1],'base64')).transparentPixels>0;}catch{}
 }
 const body={model,prompt,size:`${brief.size.width}x${brief.size.height}`,output_format:'png',response_format:'b64_json',watermark:false,background:directAlpha?'transparent':'opaque',...(images.length?{image:images.length===1?images[0]:images}:{})};
 if(brief.background==='transparent'&&!directAlpha)body.prompt+='\n本步骤先生成可准确分离的前景主体，主体完整、留出边距，使用简单纯色背景，不画棋盘格。下一步骤会将全部要求的前景主体合并提取为透明图层。';
 const first=await request(body),data=first.value.data?.[0]?.b64_json;
 if(typeof data!=='string'||data.length>20000000)fail('INVALID_IMAGE','豆包没有返回可用 PNG 图片。',502);
 let bytes=Buffer.from(data,'base64');const validation=inspectPNG(bytes),requestIds=[first.requestId].filter(Boolean);
 if(validation.width!==brief.size.width||validation.height!==brief.size.height)fail('SIZE_MISMATCH','返回尺寸与需求不一致，已停止交付。',502);
 if(brief.background!=='transparent'||directAlpha)return {bytes,requestId:requestIds.join(' / '),usage:first.value.usage,pipeline:directAlpha?'ark-transparent-edit':'ark-image'};
 const second=await request({model,prompt:'只提取用户要求的全部前景主体为一个完整合并图层，主体本身、镂空、半透明边缘与文字保持原样。不要把背景、投影背景、棋盘格单独作为前景。仅输出底图和一个命名为 UISTUDIO_SUBJECT 的前景图层。用户要求：'+JSON.stringify({subjects:brief.subjects,texts:brief.texts,preserve:brief.preserve}),image:'data:image/png;base64,'+data,layer_decomposition:true,size:'auto',output_format:'png',response_format:'b64_json',watermark:false});
 if(second.requestId)requestIds.push(second.requestId);
 const items=second.value.data;
 if(!Array.isArray(items)||items.some(x=>x.error))fail('LAYER_EXTRACTION_FAILED','透明主体提取未完整完成，没有交付不完整的图。',502);
 const base=items.find(x=>x.z_index===0),layers=items.filter(x=>Number.isInteger(x.z_index)&&x.z_index>0);
 if(base?.size!==`${brief.size.width}x${brief.size.height}`)fail('LAYER_SIZE_MISMATCH','透明图层的底图尺寸不一致，已停止交付。',502);
 if(layers.length!==1)fail('LAYER_REVIEW_REQUIRED','透明主体被拆为多个图层，暂不能确认主体完整性。这次未作为最终透明图交付。',422);
 const layer=layers[0];if(typeof layer.b64_json!=='string'||layer.b64_json.length>20000000)fail('LAYER_EXTRACTION_FAILED','透明主体文件未完整返回。',502);
 try{bytes=placeTransparentLayer(Buffer.from(layer.b64_json,'base64'),brief.size.width,brief.size.height,layer.bounding_box?.absolute);}catch{fail('LAYER_GEOMETRY_INVALID','透明图层的位置、比例或编码未通过验证，已停止交付。',502);}
 return {bytes,requestId:requestIds.join(' / '),pipeline:'ark-image-then-subject-layer',usage:{generation:first.value.usage,extraction:second.value.usage},layer:{name:layer.name||'',description:layer.description||'',boundingBox:layer.bounding_box.absolute}};
}
