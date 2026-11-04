import {inflateSync,deflateSync} from 'node:zlib';
export function inspectPNG(bytes,includePixels=false){
 const b=Buffer.from(bytes);
 if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('返回文件不是有效 PNG。');
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20),depth=b[24],color=b[25];
 if(!width||!height||width*height>8294400||depth!==8||![2,6].includes(color)||b[28]!==0)throw Error('图片编码或分辨率暂不支持验证。');
 const parts=[];let ended=false;
 for(let p=8;p+12<=b.length;){const n=b.readUInt32BE(p);if(p+12+n>b.length)throw Error('PNG文件不完整。');const t=b.toString('ascii',p+4,p+8);if(t==='IDAT')parts.push(b.subarray(p+8,p+8+n));if(t==='IEND'){ended=true;break;}p+=n+12;}
 if(!ended||!parts.length)throw Error('PNG文件不完整。');
 const channels=color===6?4:3,stride=width*channels,raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*height});
 if(raw.length!==(stride+1)*height)throw Error('像素数据不完整。');
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 let previous=Buffer.alloc(stride),p=0,transparentPixels=0,visiblePixels=0,pixels=includePixels?Buffer.alloc(width*height*4):null;
 for(let y=0;y<height;y++){const filter=raw[p++];if(filter>4)throw Error('PNG过滤格式无效。');const row=Buffer.from(raw.subarray(p,p+stride));p+=stride;for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,c=x>=channels?previous[x-channels]:0,u=previous[x];row[x]=(row[x]+(filter===1?a:filter===2?u:filter===3?Math.floor((a+u)/2):filter===4?paeth(a,u,c):0))&255;}for(let x=0;x<stride;x+=channels){const alpha=channels===4?row[x+3]:255;if(alpha<255)transparentPixels++;if(alpha>0)visiblePixels++;if(pixels){const dest=(y*width+x/channels)*4;pixels[dest]=row[x];pixels[dest+1]=row[x+1];pixels[dest+2]=row[x+2];pixels[dest+3]=alpha;}}previous=row;}
 if(!visiblePixels)throw Error('返回了全透明空图。');
 return {width,height,bytes:b.length,hasAlpha:color===6,transparentPixels,visiblePixels,...(pixels?{pixels}:{})};
}
function crc32(bytes){let c=0xffffffff;for(const byte of bytes){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return out;}
export function encodeRGBA(width,height,pixels){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height>8294400||pixels.length!==width*height*4)throw Error('透明画布规格无效。');
 const head=Buffer.alloc(13);head.writeUInt32BE(width);head.writeUInt32BE(height,4);head[8]=8;head[9]=6;
 const raw=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)Buffer.from(pixels.buffer,pixels.byteOffset+y*width*4,width*4).copy(raw,y*(width*4+1)+1);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
/** Reconstruct one subject layer using the provider's absolute bounding box.
 * Premultiplied-alpha interpolation preserves translucent edges without a solid matte. */
export function placeTransparentLayer(layerBytes,width,height,box){
 return composeTransparentLayers([{bytes:layerBytes,box,zIndex:1}],width,height);
}
function blendTransparentLayer(target,layerBytes,width,height,box){
 const source=inspectPNG(layerBytes,true);
 if(!source.hasAlpha||!Array.isArray(box)||box.length!==4||box.some(x=>!Number.isInteger(x)))throw Error('图层缺少透明通道或位置。');
 const [left,top,right,bottom]=box,w=right-left,h=bottom-top;
 if(left<0||top<0||right>width||bottom>height||w<1||h<1||Math.abs((source.width/source.height)/(w/h)-1)>.05)throw Error('图层位置或比例不匹配。');
 const p=source.pixels;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sx=Math.max(0,Math.min(source.width-1,(x+.5)*source.width/w-.5)),sy=Math.max(0,Math.min(source.height-1,(y+.5)*source.height/h-.5));
  const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,source.width-1),y1=Math.min(y0+1,source.height-1),fx=sx-x0,fy=sy-y0;
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy],ids=[(y0*source.width+x0)*4,(y0*source.width+x1)*4,(y1*source.width+x0)*4,(y1*source.width+x1)*4];
  let alpha=0;const colors=[0,0,0];for(let i=0;i<4;i++){const weight=weights[i]*p[ids[i]+3];alpha+=weight;for(let c=0;c<3;c++)colors[c]+=weight*p[ids[i]+c];}
  const d=((top+y)*width+left+x)*4,backAlpha=target[d+3],remaining=1-alpha/255,outAlpha=alpha+backAlpha*remaining;
  if(outAlpha)for(let c=0;c<3;c++)target[d+c]=Math.round((colors[c]+target[d+c]*backAlpha*remaining)/outAlpha);
  target[d+3]=Math.round(outAlpha);
 }
}
export function composeTransparentLayers(layers,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>8294400||!Array.isArray(layers)||layers.length<1||layers.length>16)throw Error('透明图层或画布数量无效。');
 const order=layers.map(x=>x.zIndex);
 if(order.some(z=>!Number.isInteger(z)||z<1)||new Set(order).size!==order.length)throw Error('图层叠放顺序无效。');
 const target=Buffer.alloc(width*height*4);
 for(const layer of layers.slice().sort((a,b)=>a.zIndex-b.zIndex))blendTransparentLayer(target,layer.bytes,width,height,layer.box);
 return encodeRGBA(width,height,target);
}
