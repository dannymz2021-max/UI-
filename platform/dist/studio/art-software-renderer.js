/** CPU renderer for the same modeled geometry used by WebGL. It interpolates
 * normals and material coordinates per fragment, including metal reflection
 * bands and glossy softbox highlights; it is not a flat-image fallback. */
import * as THREE from './vendor/three.module.js';

const clamp01 = n => Math.max(0, Math.min(1, n));
const normalized = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const toneByte = value => {
  const x = Math.max(0, value * .91);
  const tone = clamp01((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14));
  return 255 * (tone <= .0031308 ? tone * 12.92 : 1.055 * Math.pow(tone, 1 / 2.4) - .055);
};
const COLOR_LOOKUP = Float32Array.from({length:16385}, (_,i) => toneByte(i / 2048));
const colorByte = value => COLOR_LOOKUP[Math.min(16384, Math.max(0, Math.round(value * 2048)))];
const projectionCache = new WeakMap();
const STRIDE = 8;

function rampFor(stops) {
  if (!stops?.length) return null;
  const sorted = stops.map(([at,color]) => [at, new THREE.Color(color)]).sort((a,b) => a[0] - b[0]);
  const ramp = new Float32Array(1024 * 3);
  for (let i=0; i<1024; i++) {
    const t = i / 1023; let from=sorted[0], to=sorted.at(-1);
    for (let j=1;j<sorted.length;j++) if(t<=sorted[j][0]) {from=sorted[j-1];to=sorted[j];break;}
    const f=clamp01((t-from[0])/(to[0]-from[0]||1));
    for(let c=0;c<3;c++){const key=['r','g','b'][c];ramp[i*3+c]=from[1][key]+(to[1][key]-from[1][key])*f;}
  }
  return ramp;
}
function materialInfo(m) {
  const data=m.userData || {};
  return { color: m.color || new THREE.Color('#ffffff'), opacity: m.opacity ?? 1,
    roughness: m.roughness ?? .25, metalness: m.metalness ?? .3,
    side: m.side ?? THREE.FrontSide, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity ?? 1, specularIntensity: m.specularIntensity ?? 1,
    ramp: rampFor(data.studioBands), bandColors:data.studioBands, surface: data.studioSurface || 'object',
    baseColor: new THREE.Color(data.studioBaseColor || m.color || '#ffffff') };
}
function projectMesh(object, viewProjection, width, height) {
  const geometry=object.geometry, positions=geometry.attributes.position, normals=geometry.attributes.normal, uv=geometry.attributes.uv;
  if(!positions||!normals)return null;
  const sourceMaterials=(Array.isArray(object.material)?object.material:[object.material]);
  const materials=sourceMaterials.map(materialInfo);
  const matrix=new THREE.Matrix4().multiplyMatrices(viewProjection,object.matrixWorld).elements;
  const normal=new THREE.Matrix3().getNormalMatrix(object.matrixWorld).elements;
  const cacheKey=geometry.userData.persistentText?[width,height,...matrix,...normal].join('|'):null;
  const count=positions.count, index=geometry.index?.array, cached=projectionCache.get(geometry);
  let projected, materialIds;
  if(cacheKey&&cached?.key===cacheKey){projected=cached.projected;materialIds=cached.materialIds;}
  else {
    projected=new Float32Array(count*STRIDE);materialIds=new Uint8Array(count);
    if(materials.length>1)for(const group of geometry.groups)for(let j=group.start;j<Math.min(group.start+group.count,index?.length??count);j++)materialIds[index?index[j]:j]=group.materialIndex;
    for(let i=0;i<count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),at=i*STRIDE;
      const divisor=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];
      projected[at]=((matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/divisor+1)*width/2;
      projected[at+1]=(1-(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/divisor)*height/2;
      projected[at+2]=(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14])/divisor;
      const vx=normals.getX(i),vy=normals.getY(i),vz=normals.getZ(i);
      const nx=normal[0]*vx+normal[3]*vy+normal[6]*vz,ny=normal[1]*vx+normal[4]*vy+normal[7]*vz,nz=normal[2]*vx+normal[5]*vy+normal[8]*vz;
      const length=Math.hypot(nx,ny,nz)||1;
      projected[at+3]=nx/length;projected[at+4]=ny/length;projected[at+5]=nz/length;
      projected[at+6]=uv?.getX(i)||0;projected[at+7]=1-(uv?.getY(i)||0);
    }
    if(cacheKey)projectionCache.set(geometry,{key:cacheKey,projected,materialIds});
  }
  return{projected,materials,materialIds,index,count};
}

function rasterizeMesh(mesh,width,height,pixels,zBuffer,lighting) {
  const{projected:p,index,count,materialIds,materials}=mesh,{key,fill,half,gloss,glow}=lighting;
  const triangleCount=Math.floor((index?.length??count)/3);
  for(let t=0;t<triangleCount;t++){
    const i0=index?index[t*3]:t*3,i1=index?index[t*3+1]:t*3+1,i2=index?index[t*3+2]:t*3+2;
    const a=i0*STRIDE,b=i1*STRIDE,c=i2*STRIDE,mat=materials[materialIds[i0]]||materials[0];
    const ax=p[a],ay=p[a+1],bx=p[b],by=p[b+1],cx=p[c],cy=p[c+1];
    const area=(cx-ax)*(by-ay)-(cy-ay)*(bx-ax);
    if(Math.abs(area)<.00001||(mat.side===THREE.FrontSide&&area<=0)||(mat.side===THREE.BackSide&&area>=0))continue;
    const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
    const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
    if(maxX<minX||maxY<minY)continue;
    const inverse=1/area,dx0=(cy-by)*inverse,dy0=-(cx-bx)*inverse,dx1=(ay-cy)*inverse,dy1=-(ax-cx)*inverse;
    const startX=minX+.5,startY=minY+.5;
    let row0=((startX-bx)*(cy-by)-(startY-by)*(cx-bx))*inverse,row1=((startX-cx)*(ay-cy)-(startY-cy)*(ax-cx))*inverse;
    const az=p[a+2],bz=p[b+2],cz=p[c+2],alpha=clamp01(mat.opacity);
    const rough=mat.roughness,metal=mat.metalness,specularPower=25+(1-rough)*110;
    const er=(mat.emissive?.r||0)*mat.emissiveIntensity,eg=(mat.emissive?.g||0)*mat.emissiveIntensity,eb=(mat.emissive?.b||0)*mat.emissiveIntensity;
    for(let y=minY;y<=maxY;y++){
      let u=row0,v=row1,cell=y*width+minX;
      for(let x=minX;x<=maxX;x++,cell++,u+=dx0,v+=dx1){
        const w=1-u-v;if(u<-.000001||v<-.000001||w<-.000001)continue;
        const depth=u*az+v*bz+w*cz;if(depth< -1||depth>1||depth>=zBuffer[cell])continue;
        zBuffer[cell]=depth;
        let nx=u*p[a+3]+v*p[b+3]+w*p[c+3],ny=u*p[a+4]+v*p[b+4]+w*p[c+4],nz=u*p[a+5]+v*p[b+5]+w*p[c+5];
        const invLength=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);nx*=invLength;ny*=invLength;nz*=invLength;
        const ndl=Math.max(0,nx*key[0]+ny*key[1]+nz*key[2]),f=Math.max(0,nx*fill[0]+ny*fill[1]+nz*fill[2]);
        const grazing=1-Math.max(0,nz),fresnel=grazing*grazing*grazing;
        const spec=Math.pow(Math.max(0,nx*half[0]+ny*half[1]+nz*half[2]),specularPower)*gloss*(.4+metal*.8);
        // A long studio softbox is reflected on curved bevels and objects.
        const reflectedY=2*nz*(ny*key[1]+nx*key[0]),bandDistance=(reflectedY-.48)/(.10+rough*.19);
        const softbox=Math.exp(-bandDistance*bandDistance)*(.18+metal*.62)*gloss;
        let red=mat.color.r,green=mat.color.g,blue=mat.color.b;
        if(mat.ramp){
          const ty=u*p[a+7]+v*p[b+7]+w*p[c+7];
          const rampAt=Math.round(clamp01(ty)*1023)*3;
          red=mat.ramp[rampAt];green=mat.ramp[rampAt+1];blue=mat.ramp[rampAt+2];
        }
        const ambient=.12+(ny+1)*.035;
        const diffuse=ambient+ndl*.85+f*.16;
        const shine=(spec+softbox+fresnel*gloss*(.14+glow*.25))*mat.specularIntensity;
        // Metals tint reflections slightly; clear lacquer retains white glints.
        const metallicTint=metal*.42;
        const rr=red*diffuse+shine*(1-metallicTint+red*metallicTint)+er;
        const gg=green*(diffuse*.985)+shine*(1-metallicTint+green*metallicTint)+eg;
        const bb=blue*(ambient*1.12+ndl*.80+f*.24)+shine*(1-metallicTint+blue*metallicTint)+eb;
        const r=colorByte(rr),g=colorByte(gg),bl=colorByte(bb),at=cell*4;
        if(alpha>.999){pixels[at]=r;pixels[at+1]=g;pixels[at+2]=bl;pixels[at+3]=255;}
        else{
          const oldAlpha=pixels[at+3]/255,outAlpha=alpha+oldAlpha*(1-alpha),oldWeight=oldAlpha*(1-alpha);
          pixels[at]=(r*alpha+pixels[at]*oldWeight)/(outAlpha||1);pixels[at+1]=(g*alpha+pixels[at+1]*oldWeight)/(outAlpha||1);pixels[at+2]=(bl*alpha+pixels[at+2]*oldWeight)/(outAlpha||1);pixels[at+3]=outAlpha*255;
        }
      }
      row0+=dy0;row1+=dy1;
    }
  }
}

export function renderSoftwareScene(canvas,scene,camera,opts){
  const doc=canvas.ownerDocument||globalThis.document,width=opts.width,height=opts.height;
  const factor=width*height<=180000?2:width*height<=900000?1.25:1;
  const w=Math.round(width*factor),h=Math.round(height*factor),bufferCanvas=doc.createElement('canvas');bufferCanvas.width=w;bufferCanvas.height=h;
  const bufferContext=bufferCanvas.getContext('2d'),image=bufferContext.createImageData(w,h),pixels=image.data,zBuffer=new Float32Array(w*h);zBuffer.fill(Infinity);
  const angle=(opts.lightDirection??-35)*Math.PI/180;
  const key=normalized(Math.sin(angle)*.95,Math.cos(angle)*.95,1),fill=normalized(-key[0],-.15,.75);
  const lighting={key,fill,half:normalized(key[0],key[1],key[2]+1),gloss:clamp01((opts.gloss??78)/100),glow:clamp01((opts.glow??28)/100)};
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),meshes=[];
  scene.traverseVisible(object=>{if(object.isMesh&&object.material&&object.visible)meshes.push(object);});
  meshes.sort((a,b)=>a.matrixWorld.elements[14]-b.matrixWorld.elements[14]);
  for(const object of meshes){const data=projectMesh(object,viewProjection,w,h);if(data)rasterizeMesh(data,w,h,pixels,zBuffer,lighting);}
  bufferContext.putImageData(image,0,0);canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器无法建立3D软件渲染画布。');
  ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bufferCanvas,0,0,width,height);
  return{engine:'cpu-triangle-commercial-3d',geometry:true,graphicsMode:'software',supersampling:factor};
}
