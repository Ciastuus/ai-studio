const DFF_SHA='60624a3b9e49ae877a6ab3428b6ab5c2dc8be71d637bff36776e1a018060920e';
const TXD_SHA='d72a3a248ce080f2c2b46eff95e9ea308d48c9393cc3476757967a75537a5bde';
const MODELS={LF:[.3966,.3882,-.7764,.2697],RF:[-.3966,.6118,-.7764,.2697],LR:[.4611,-.1161,-.7762,.7740],RR:[-.4611,1.1161,-.7771,.7735]};
const PANELS={LF:[0,0,'L'],RF:[256,0,'R'],LR:[0,256,'L'],RR:[256,256,'R']};
const DIM={ls:[.42,.29],pd:[.47,.30],badge:[.29,.29]};
const hex=(s,h)=>{s=String(s||h).replace('#','');if(!/^[0-9a-f]{6}$/i.test(s))s=h.replace('#','');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16))};
const num=(n,label)=>{let x=Number(n);if(!Number.isFinite(x))throw Error('Niepoprawna wartosc '+label);return x};
async function sha(d){if(!globalThis.crypto?.subtle)return null;let dig=await crypto.subtle.digest('SHA-256',d);return Array.from(new Uint8Array(dig),x=>x.toString(16).padStart(2,'0')).join('')}
export async function validateNative(dff,txd){
 if(dff.byteLength!==360448||txd.byteLength!==307200)throw Error('Nieprawidlowy model. Wybierz oryginalny DFF i TXD z paczki Sultan LSPD V10.');
 const [a,b]=await Promise.all([sha(dff),sha(txd)]);
 if(a&&a!==DFF_SHA)throw Error('DFF nie jest oryginalnym modelem bazowym V10.');
 if(b&&b!==TXD_SHA)throw Error('TXD nie jest oryginalna tekstura bazowa V10.');
 if(new DataView(dff).getUint32(0,true)!==16||new DataView(txd).getUint32(0,true)!==22)throw Error('Niepoprawny naglowek RenderWare');
 return true;
}
function sampleRGBA(img,x,y,out){
 const w=img.width,h=img.height,a=img.data;
 if(x<0||y<0||x>w-1||y>h-1){out.fill(0);return}
 const x0=Math.floor(x),x1=Math.min(w-1,x0+1),y0=Math.floor(y),y1=Math.min(h-1,y0+1),u=x-x0,v=y-y0;
 const i=(y0*w+x0)*4,j=(y0*w+x1)*4,k=(y1*w+x0)*4,l=(y1*w+x1)*4;
 for(let c=0;c<4;c++)out[c]=((a[i+c]*(1-u)+a[j+c]*u)*(1-v)+(a[k+c]*(1-u)+a[l+c]*u)*v);
}
export function bakeAtlas(state,art){
 const bg=hex(state.doorpaint,'#efeee8'),out=new Uint8Array(512*512*4),px=new Float64Array(4);
 for(let i=0;i<out.length;i+=4){out[i]=bg[0];out[i+1]=bg[1];out[i+2]=bg[2];out[i+3]=255}
 for(const [panel,[ox,oy,side]] of Object.entries(PANELS)){
  const [ax,bx,ay,by]=MODELS[panel],left=side==='L';
  for(const kind of ['ls','badge','pd']){
   const key=kind+(left?'L':'R'),e=state.elements[key],im=art[kind];if(!e||!im)throw Error('Brakuje nakladki '+key);
   const z=num(e.z,key+'.z'),y=num(e.y,key+'.y'),scale=num(e.scale,key+'.scale'),ang=num(e.rotation||0,key+'.rotation')*Math.PI/180;
   if(scale<=0||scale>5)throw Error('Zla skala '+key);
   const w=DIM[kind][0]*scale,h=DIM[kind][1]*scale,cs=Math.cos(ang),sn=Math.sin(ang);
   for(let row=oy;row<oy+256;row++)for(let col=ox;col<ox+256;col++){
    const gz=((col+.5)/512-bx)/ax,gy=((row+.5)/512-by)/ay;
    const lx=(gz-z)/(w*(left?1:-1)),ly=(y-gy)/h,xr=cs*lx+sn*ly,yr=-sn*lx+cs*ly;
    const sx=(xr+.5)*(im.width-1),sy=(yr+.5)*(im.height-1);
    if(sx<0||sy<0||sx>im.width-1||sy>im.height-1)continue;
    sampleRGBA(im,sx,sy,px);const a=px[3]/255;if(a<=0)continue;
    const i=(row*512+col)*4;for(let c=0;c<3;c++)out[i+c]=Math.round(out[i+c]*(1-a)+px[c]*a);
   }
  }
 }
 return out;
}
const rgb565=(r,g,b)=>(((r*31+127)/255|0)<<11)|(((g*63+127)/255|0)<<5)|((b*31+127)/255|0);
const from565=n=>[((n>>11)&31)*255/31,((n>>5)&63)*255/63,(n&31)*255/31];
export function encodeDXT3(data,w=512,h=512){
 if(data.length!==w*h*4||w%4||h%4)throw Error('Bad DXT3 image');
 const output=new Uint8Array(w*h),v=new DataView(output.buffer);let offset=0;
 for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=4){
  for(let i=0;i<8;i++){const a=i*2,b=a+1,p=((y+(a>>2))*w+x+(a&3))*4,q=((y+(b>>2))*w+x+(b&3))*4;output[offset+i]=(Math.round(data[p+3]/17)&15)|((Math.round(data[q+3]/17)&15)<<4)}
  let brightHi=-1e10,brightLo=1e10,hi=[0,0,0],lo=[0,0,0];
  for(let i=0;i<16;i++){const p=((y+(i>>2))*w+x+(i&3))*4,r=data[p],g=data[p+1],b=data[p+2],lum=.299*r+.587*g+.114*b;
   if(lum>brightHi){brightHi=lum;hi=[r,g,b]}if(lum<brightLo){brightLo=lum;lo=[r,g,b]}}
  let c0=rgb565(...hi),c1=rgb565(...lo);if(c0===c1){if(c0<65535)c0++;else c1--}if(c0<c1)[c0,c1]=[c1,c0];
  const a=from565(c0),b=from565(c1),palette=[a,b,a.map((n,j)=>(2*n+b[j])/3),a.map((n,j)=>(n+2*b[j])/3)];
  let bits=0;for(let i=0;i<16;i++){const p=((y+(i>>2))*w+x+(i&3))*4;let best=1e15,bi=0;
   for(let j=0;j<4;j++){let d=0;for(let k=0;k<3;k++){let n=data[p+k]-palette[j][k];d+=n*n}if(d<best){best=d;bi=j}}bits=(bits|(bi<<(2*i)))>>>0}
  v.setUint16(offset+8,c0,true);v.setUint16(offset+10,c1,true);v.setUint32(offset+12,bits,true);offset+=16;
 }
 return output;
}
export function patchTXD(raw,dxt){
 const result=new Uint8Array(raw.slice(0)),name=new TextEncoder().encode('mrplspddoors512'),v=new DataView(result.buffer);
 let ix=-1;search:for(let i=20;i<result.length-name.length;i++){for(let j=0;j<name.length;j++)if(result[i+j]!==name[j])continue search;ix=i;break}
 if(ix<20)throw Error('Brakuje atlasu mrplspddoors512');const o=ix-20;
 if(String.fromCharCode(...result.subarray(o+88,o+92))!=='DXT3'||v.getUint32(o+100,true)!==262144)throw Error('Niepoprawny format DXT3 TXD');
 if(dxt.length!==262144)throw Error('Niepoprawny rozmiar rastera');result.set(dxt,o+104);return result;
}
function chunks(v,start,end){let res=[];for(let p=start;p+12<=end;){let type=v.getUint32(p,true),size=v.getUint32(p+4,true);if(size>v.byteLength-p-12||p+12+size>end)break;res.push({p,size,type});p+=12+size}return res}
function inside(v,node){return chunks(v,node.p+12,node.p+12+node.size)}
function framePosition(v,off,id){let p=off+4+id*56+36;return [v.getFloat32(p,true),v.getFloat32(p+4,true),v.getFloat32(p+8,true)]}
export function makeSurface(scene,name){
 let obj;scene.traverse(m=>{if(m.isMesh&&m.name===name)obj=m});if(!obj)throw Error('Model GLB nie zawiera siatki '+name);
 obj.updateWorldMatrix(true,false);const g=obj.geometry,p=g.attributes.position,ind=g.index,faces=ind?ind.count/3:p.count/3,verts=[];
 for(let i=0;i<faces;i++){
  let tri=[];for(let j=0;j<3;j++){let k=ind?ind.getX(i*3+j):i*3+j,q=[p.getX(k),p.getY(k),p.getZ(k)],e=obj.matrixWorld.elements;
   tri.push([e[0]*q[0]+e[4]*q[1]+e[8]*q[2]+e[12],e[1]*q[0]+e[5]*q[1]+e[9]*q[2]+e[13],e[2]*q[0]+e[6]*q[1]+e[10]*q[2]+e[14]])}
  let [a,b,c]=tri,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)>1e-10)verts.push({a,b,c,den});
 }
 return (x,z)=>{let best=-Infinity,nearest=Infinity,nearestY=null;
  for(const {a,b,c,den} of verts){const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,w=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,q=1-u-w,yy=u*a[1]+w*b[1]+q*c[1];
   if(Math.min(u,w,q)>-.0005&&Math.max(u,w,q)<1.0005&&yy>.1&&yy<.65)best=Math.max(best,yy);
   for(const vertex of [a,b,c]){let d=(x-vertex[0])**2+(z-vertex[2])**2;if(d<nearest&&vertex[1]>.1&&vertex[1]<.65){nearest=d;nearestY=vertex[1]}}
  }return Number.isFinite(best)?best:nearestY;
 };
}
export function patchDFF(raw,state,hood,trunk){
 const bytes=new Uint8Array(raw.slice(0)),v=new DataView(bytes.buffer);
 if(v.getUint32(0,true)!==16)throw Error('Nieprawidlowy DFF');
 const roots=chunks(v,12,12+v.getUint32(4,true)),framesNode=roots[1],geomsNode=roots[2];
 if(framesNode?.type!==14||geomsNode?.type!==26)throw Error('Nieznany uklad RW');
 const f=inside(v,framesNode)[0].p+12;const n=v.getUint32(f,true);if(n<62)throw Error('Brak klatek belki');
 const geoms=inside(v,geomsNode).slice(1);if(geoms.length!==38)throw Error('Niekompatybilny zestaw geometrii');
 const bar=state.elements.bar,goal=[num(bar.x,'bar.x'),-num(bar.z,'bar.z'),num(bar.y,'bar.y')],old=[0,-.12,.85],delta=goal.map((x,i)=>x-old[i]);
 for(const id of [59,60,61]){const p=f+4+id*56+36;for(let j=0;j<3;j++)v.setFloat32(p+4*j,v.getFloat32(p+4*j,true)+delta[j],true)}
 let reports={};for(const [id,frame,key,height] of [[36,16,'policeH',hood],[37,17,'policeT',trunk]]){
  const geom=geoms[id],s=inside(v,geom)[0].p+12,flag=v.getUint32(s,true),tri=v.getUint32(s+4,true),count=v.getUint32(s+8,true),m=v.getUint32(s+12,true);
  if(m!==1||count<4||count>2000)throw Error('Niekompatybilne litery POLICE');
  const uv=(flag>>>16)&255,off=s+16+((flag&8)?count*4:0)+uv*8*count+tri*8+24;
  if(off+count*24>bytes.length)throw Error('Pozycja wierzcholkow poza DFF');
  const parent=framePosition(v,f,frame),pts=[],norm=[];
  for(let i=0;i<count;i++){let p=off+i*12;pts.push([v.getFloat32(p,true)+parent[0],v.getFloat32(p+8,true)+parent[2],-(v.getFloat32(p+4,true)+parent[1])]);let n=off+count*12+i*12;norm.push([v.getFloat32(n,true),v.getFloat32(n+4,true)])}
  const cx=(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2,cz=(Math.min(...pts.map(p=>p[2]))+Math.max(...pts.map(p=>p[2])))/2;
  const e=state.elements[key],scale=num(e.scale,key+'.scale'),angle=num(e.rotation||0,key+'.rotation')*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],locals=[],miss=0;
  for(let i=0;i<count;i++){const dx=(pts[i][0]-cx)*scale,dz=(pts[i][2]-cz)*scale,x=num(e.x,key+'.x')+dx*cos-dz*sin,z=num(e.z,key+'.z')+dx*sin+dz*cos;
   let y=height?.(x,z);if(!Number.isFinite(y)){y=num(e.y,key+'.y');miss++}
   let p=[x-parent[0],-z-parent[1],y+.003-parent[2]];locals.push(p);
   for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[j]);max[j]=Math.max(max[j],p[j]);v.setFloat32(off+i*12+j*4,p[j],true)}
   let n=off+count*12+i*12,a=norm[i][0],b=norm[i][1];v.setFloat32(n,a*cos+b*sin,true);v.setFloat32(n+4,-a*sin+b*cos,true);
  }
  const center=min.map((x,i)=>(x+max[i])/2);let radius=0;for(const p of locals)radius=Math.max(radius,Math.hypot(...p.map((x,i)=>x-center[i])));
  for(let j=0;j<3;j++)v.setFloat32(off-24+j*4,center[j],true);v.setFloat32(off-12,radius+.025,true);
  reports[key]={vertices:count,withoutSurface:miss};
 }
 return {bytes,reports};
}
function crc32(src){let crc=0xffffffff;for(const b of src){crc^=b;for(let j=0;j<8;j++)crc=crc&1?(crc>>>1)^0xedb88320:crc>>>1}return (crc^0xffffffff)>>>0}
const te=new TextEncoder();
export function zipStore(files){
 let local=[],central=[],off=0;
 for(const [filename,payload] of files){
  const name=te.encode(filename),bytes=typeof payload==='string'?te.encode(payload):payload,crc=crc32(bytes),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,name.length,true);h.set(name,30);local.push(h,bytes);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,bytes.length,true);cv.setUint32(24,bytes.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,off,true);c.set(name,46);central.push(c);off+=h.length+bytes.length;
 }
 const dir=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);
 dv.setUint32(0,0x06054b50,true);dv.setUint16(8,central.length,true);dv.setUint16(10,central.length,true);dv.setUint32(12,dir,true);dv.setUint32(16,off,true);
 let out=new Uint8Array(off+dir+22),p=0;for(const part of [...local,...central,end]){out.set(part,p);p+=part.length}return out;
}
export async function buildNative({dff,txd,state,art,carScene}){
 await validateNative(dff,txd);
 const img=bakeAtlas(state,art),nativeTxd=patchTXD(txd,encodeDXT3(img));
 const fixed=patchDFF(dff,state,makeSurface(carScene,'bonnet_ok_1_0'),makeSurface(carScene,'boot_ok_3_0'));
 const json=JSON.stringify({...state,exporter:'M-RP browser native DFF/TXD'},null,2);
 const instructions='SULTAN LSPD V10 NATIVE EXPORT\r\nPodmien w istniejacym zasobie MTA:SA pliki files/sultan_lspd.dff i files/sultan.txd.\r\nZachowaj swoje meta.xml oraz c_sultan.lua / s_sultan.lua.\r\nDFF zmienia belke i polozenie napisow na masce i bagazniku.\r\nTXD zmienia napisy, herb i kolor poszycia drzwi.\r\nLakier w GTA SA ustawia setVehicleColor (Lua), nie sam DFF/TXD.\r\n';
 return {zip:zipStore([['files/sultan_lspd.dff',fixed.bytes],['files/sultan.txd',nativeTxd],['sultan_lspd_editor.json',json],['README.txt',instructions]]),reports:fixed.reports};
}