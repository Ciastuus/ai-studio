import { encodeDXT3, patchTXD } from './native-export.js';

/* The M-RP door lettering is baked into one 512x512 DXT3 atlas.
   Extract decals into independently movable raster layers. Never move the
   white door mesh itself to reposition letters. */
const regions=[
 {id:'lsL',name:'LS — lewe przednie',region:[59,82,100,156],quadrant:[0,0,256,256]},
 {id:'badgeL',name:'Herb — lewe przednie',region:[159,78,85,156],quadrant:[0,0,256,256]},
 {id:'badgeR',name:'Herb — prawe przednie',region:[261,78,86,157],quadrant:[256,0,256,256]},
 {id:'pdR',name:'PD — prawe przednie',region:[350,81,117,158],quadrant:[256,0,256,256]},
 {id:'pdL',name:'PD — lewe tylne',region:[10,332,150,176],quadrant:[0,256,256,256]},
 {id:'lsR',name:'LS — prawe tylne',region:[383,326,112,179],quadrant:[256,256,256,256]}
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function bg(image,x,y){const i=(y*512+x)*4;return image.data.slice(i,i+3)}
function polygonBounds(item){let w=item.w*item.scale,h=item.h*item.scale;return {x:item.cx-w/2,y:item.cy-h/2,w,h}}
function alphaPixel(r,g,b,bg){
 const distance=Math.max(Math.abs(r-bg[0]),Math.abs(g-bg[1]),Math.abs(b-bg[2]));
 return Math.round(clamp((distance-13)/20,0,1)*255);
}
export function createDecalEditor(txdMap,elementIds){
 const item=txdMap.get('mrplspddoors512'),texture=item?.texture||item;
 if(!texture?.image||texture.image.width!==512||texture.image.height!==512||
    !texture.image.data||texture.image.data.length!==512*512*4)return null;
 const preview=document.getElementById(elementIds.preview),picker=document.getElementById(elementIds.select),
   scale=document.getElementById(elementIds.scale),rotation=document.getElementById(elementIds.rotation),
   reset=document.getElementById(elementIds.reset),help=document.getElementById(elementIds.help);
 if(!preview||!picker||!scale||!rotation||!reset||!help)return null;
 preview.width=512;preview.height=512;
 const source=new Uint8ClampedArray(texture.image.data),initial=new ImageData(source,512,512);
 const perQuadrant=new Map();
 for(const config of regions){
  const q=config.quadrant,tag=q[0]+':'+q[1];
  if(!perQuadrant.has(tag))perQuadrant.set(tag,bg(initial,q[0]+7,q[1]+7));
 }
 const layers=[];
 for(const cfg of regions){
  const [x,y,w,h]=cfg.region;
  const art=canvas(w,h),ctx=art.getContext('2d');
  const raw=ctx.createImageData(w,h),col=perQuadrant.get(cfg.quadrant[0]+':'+cfg.quadrant[1]);
  let active=0;
  for(let row=0;row<h;row++)for(let c=0;c<w;c++){
   const si=((y+row)*512+x+c)*4,di=(row*w+c)*4;
   for(let k=0;k<3;k++)raw.data[di+k]=source[si+k];
   const a=alphaPixel(source[si],source[si+1],source[si+2],col);
   raw.data[di+3]=a;if(a>20)active++;
  }
  if(active<50)continue;
  ctx.putImageData(raw,0,0);
  layers.push({...cfg,art,cx:x+w/2,cy:y+h/2,w,h,scale:1,rotation:0});
 }
 if(!layers.length)return null;
 const composed=canvas(512,512),ctx=composed.getContext('2d',{willReadFrequently:true});
 const display=preview.getContext('2d');
 const white={};for(const [k,c]of perQuadrant)white[k]=c;
 let selected=layers[0],dirty=false,down=null,bytes=new Uint8ClampedArray(source);
 function draw(){
  ctx.clearRect(0,0,512,512);
  for(const cfg of regions){
   const [qx,qy,qw,qh]=cfg.quadrant,col=white[qx+':'+qy];
   ctx.fillStyle='rgb('+col.join(',')+')';ctx.fillRect(qx,qy,qw,qh);
  }
  for(const l of layers){
   ctx.save();ctx.translate(l.cx,l.cy);ctx.rotate(l.rotation*Math.PI/180);
   ctx.drawImage(l.art,-l.w*l.scale/2,-l.h*l.scale/2,l.w*l.scale,l.h*l.scale);ctx.restore();
  }
  const out=ctx.getImageData(0,0,512,512);
  bytes=out.data;
  const allImages=[texture,...[...document.querySelectorAll('canvas')].filter(()=>false)];
  // TXDLoader creates DataTexture clones sharing the image; update every live map
  // that has this RenderWare atlas as its texture.
  texture.image.data.set(out.data);texture.needsUpdate=true;
  for(const tex of item._renderMaps||[]){
   if(tex?.image?.data?.length===out.data.length){tex.image.data.set(out.data);tex.needsUpdate=true}
  }
  display.clearRect(0,0,512,512);display.drawImage(composed,0,0);
  display.strokeStyle='rgba(73,142,255,.65)';display.lineWidth=1;
  display.beginPath();display.moveTo(256,0);display.lineTo(256,512);
  display.moveTo(0,256);display.lineTo(512,256);display.stroke();
  if(selected){
   const r=polygonBounds(selected);display.strokeStyle='#fbbf73';display.lineWidth=2;
   display.strokeRect(r.x,r.y,r.w,r.h);
  }
 }
 function select(layer){
  selected=layer;picker.value=selected.id;scale.value=String(selected.scale);
  rotation.value=String(selected.rotation);
  help.textContent='Zaznaczono '+selected.name+'. Przeciągnij na atlasie albo zmień skalę i obrót. Białe tło pozostaje na miejscu.';draw();
 }
 picker.replaceChildren();
 for(const l of layers){const opt=document.createElement('option');opt.value=l.id;opt.textContent=l.name;picker.append(opt)}
 picker.onchange=()=>select(layers.find(x=>x.id===picker.value)||layers[0]);
 function closest(x,y){
  for(const l of layers.slice().reverse()){
   const r=polygonBounds(l);if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)return l;
  }
  return null;
 }
 function coord(e){const r=preview.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*512,y:(e.clientY-r.top)/r.height*512}}
 preview.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;const p=coord(e),l=closest(p.x,p.y);
  if(!l)return;select(l);down={x:p.x,y:p.y,cx:l.cx,cy:l.cy};preview.setPointerCapture(e.pointerId);e.preventDefault();
 });
 preview.addEventListener('pointermove',e=>{
  if(!down||!selected)return;const p=coord(e),q=selected.quadrant;
  const w=selected.w*selected.scale/2,h=selected.h*selected.scale/2;
  selected.cx=clamp(down.cx+p.x-down.x,q[0]+w,q[0]+q[2]-w);
  selected.cy=clamp(down.cy+p.y-down.y,q[1]+h,q[1]+q[3]-h);
  dirty=true;draw();
 });
 const clear=()=>down=null;
 preview.addEventListener('pointerup',clear);preview.addEventListener('pointercancel',clear);
 scale.addEventListener('input',()=>{
  selected.scale=clamp(Number(scale.value)||1,.25,2);dirty=true;draw();
 });
 rotation.addEventListener('input',()=>{selected.rotation=clamp(Number(rotation.value)||0,-180,180);dirty=true;draw()});
 reset.onclick=()=>{
  for(const l of layers){const [x,y]=l.region;l.cx=x+l.w/2;l.cy=y+l.h/2;l.scale=1;l.rotation=0}
  dirty=false;select(layers[0]);
 };
 select(selected);
 help.textContent='Przeciągnij sam napis lub herb na atlasie. Model 3D aktualizuje teksturę na bieżąco.';
 return {
  get dirty(){return dirty},
  get texels(){return new Uint8Array(bytes)},
  get state(){return layers.map(({id,cx,cy,scale,rotation})=>({id,cx,cy,scale,rotation}))},
  updateMaterials(group){
   const maps=new Set();
   group.traverse(o=>{
    if(!o.isMesh)return;
    for(const m of Array.isArray(o.material)?o.material:[o.material])
      if(m.map?.name?.toLowerCase()==='mrplspddoors512')maps.add(m.map);
   });
   item._renderMaps=[...maps];draw();
  },
  patchSource(txd){if(!dirty)return txd;return patchTXD(txd,encodeDXT3(this.texels)).buffer}
 };
}
