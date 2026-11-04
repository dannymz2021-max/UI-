// Public list-price estimates, not the provider's invoice. No discounts or free credits assumed.
export const pricingSource='https://docs.volcengine.com/docs/ark/model-pricing?lang=zh&redirect=1';
export const pricingCheckedAt='2026-11-04';
export function previewSize(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width/height<1/16||width/height>16)return null;
 const ratio=width/height,w=Math.round(Math.sqrt(1048576*ratio)),h=Math.round(Math.sqrt(1048576/ratio));
 return {width:w,height:h,explicit:false};
}
export function estimateArkCall(model,body,value){
 const outputs=Array.isArray(value?.data)?value.data.filter(x=>typeof x.b64_json==='string'):[];
 if(!/seedream-5-0-(pro|flash)-/.test(model))return null;
 const pro=model.includes('-pro-'),inputCount=Array.isArray(body.image)?body.image.length:body.image?1:0;
 const inputCny=pro?Math.max(0,inputCount-1)*0.02:0;
 const outputCny=outputs.reduce((sum,item)=>{const [w,h]=String(item.size||body.size).split('x').map(Number);if(pro&&!(w>0&&h>0))return NaN;return sum+(pro?(body.layer_decomposition?0.15:0.30)*(w*h>2610000?2:1):0.12);},0);
 return Number.isFinite(outputCny)?Math.round((inputCny+outputCny)*100)/100:null;
}
export function arkCostPlan(model,brief,inputs,directAlpha=false){
 const pro=model.includes('seedream-5-0-pro-'),flash=model.includes('seedream-5-0-flash-'),pixels=brief.size.width*brief.size.height;
 const inputCount=inputs.references.length+(inputs.baseImage?1:0),inputCny=pro?Math.max(0,inputCount-1)*0.02:0;
 const generationCny=pro?(pixels>2610000?0.60:0.30):flash?0.12:null;
 const needsExtraction=brief.background==='transparent'&&!directAlpha;
 return {model,generationCny,inputCny,needsExtraction,maxImageCny:generationCny===null?null:Math.round((generationCny+inputCny+(needsExtraction?(pro?17*0.30:17*0.12):0))*100)/100,pricingSource,pricingCheckedAt,note:'图片费用按官方标价估算；另有需求理解的文字模型费用。实际扣费以服务商账单为准。'};
}
