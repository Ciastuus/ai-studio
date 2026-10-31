import * as THREE from 'three';
import { DFFLoader, TXDLoader } from './vendor/dff-loader.es.js';

// RenderWare has a 12-byte chunk header; frame transforms are local to a parent frame.
// Parsing only the hierarchy/atomics here keeps the established MIT mesh and TXD decoder
// responsible for geometry and compression. This is our own composition layer.
export function getRWInfo(buffer){
  const v=new DataView(buffer),n=v.byteLength;
  const u=(o)=>v.getUint32(o,true),si=(o)=>v.getInt32(o,true),f=(o)=>v.getFloat32(o,true);
  const children=(a,b)=>{const out=[];for(let p=a;p+12<=b;){const type=u(p),size=u(p+4);if(size>b-p-12||size>n-p-12)break;out.push({type,start:p,data:p+12,size,end:p+12+size});p+=12+size}return out};
  const root=children(0,n).find(c=>c.type===0x10);if(!root)throw Error('Brak głównego bloku RenderWare CLUMP.');
  const nodes=children(root.data,root.end);
  const framesChunk=nodes.find(c=>c.type===0x0e),geomChunk=nodes.find(c=>c.type===0x1a),atomChunks=nodes.filter(c=>c.type===0x14);
  if(!framesChunk||!geomChunk)throw Error('DFF nie ma listy ramek lub geometrii.');
  const frameChildren=children(framesChunk.data,framesChunk.end),frameStruct=frameChildren.find(c=>c.type===1);
  const count=u(frameStruct.data);if(count>50000||frameStruct.data+4+count*56>frameStruct.end)throw Error('Niepoprawna liczba ramek DFF.');
  const frames=[];
  for(let i=0;i<count;i++){
    const o=frameStruct.data+4+i*56;
    const rot=Array.from({length:9},(_,j)=>f(o+4*j)),pos=[f(o+36),f(o+40),f(o+44)],parent=si(o+48);
    const m=new THREE.Matrix4().set(rot[0],rot[3],rot[6],pos[0],rot[1],rot[4],rot[7],pos[1],rot[2],rot[5],rot[8],pos[2],0,0,0,1);
    frames.push({name:'frame_'+i,m,parent});
  }
  const exts=frameChildren.filter(c=>c.type===3);
  for(let i=0;i<Math.min(exts.length,count);i++){
    const plugins=children(exts[i].data,exts[i].end);
    const named=plugins.find(p=>p.type===0x253f2fe);
    if(named){const bytes=new Uint8Array(buffer,named.data,named.size),end=bytes.indexOf(0);
      const name=new TextDecoder('latin1').decode(end<0?bytes:bytes.slice(0,end)).trim();
      if(name)frames[i].name=name;
    }
  }
  const atomics=atomChunks.map((chunk,i)=>{
    const s=children(chunk.data,chunk.end).find(x=>x.type===1);
    if(!s||s.size<16)return null;
    return {frame:u(s.data),geom:u(s.data+4),index:i};
  }).filter(Boolean);
  const geoChildren=children(geomChunk.data,geomChunk.end),geoms=geoChildren.filter(c=>c.type===0x0f);
  return {frames,atomics,geometries:geoms.length,version:v.getUint32(8,true),bytes:n};
}

export function nativeGroup(buffer, textureBuffers=[]){
  const dict=new Map(),txdDetails=[];
  for(const entry of textureBuffers){
    try{
      const got=new TXDLoader().parse(entry.data);
      for(const [name,tex] of got)dict.set(name.toLowerCase(),tex);
      txdDetails.push({name:entry.name,count:got.size});
    }catch(e){throw new Error('Nie można odczytać '+entry.name+': '+e.message)}
  }
  const loader=new DFFLoader();loader.setTextureDictionary(dict);
  const libGroup=loader.parse(buffer);
  const metadata=getRWInfo(buffer),parts=libGroup.children.filter(x=>x.isMesh||x.isSkinnedMesh);
  if(parts.length!==metadata.geometries)throw Error('Parser odczytał '+parts.length+' geometrii, DFF ma '+metadata.geometries+'. Nie można poprawnie połączyć atomików.');
  // Coordinate conversion: RenderWare Z up -> Three.js Y up, GTA longitudinal Y -> negative Z.
  const convert=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1);
  const matrices=Array(metadata.frames.length);
  const resolving=new Set();
  function frameMatrix(i){
    if(matrices[i])return matrices[i];
    if(i<0||i>=metadata.frames.length)return new THREE.Matrix4();
    if(resolving.has(i))throw Error('Cykliczne powiązanie ramek DFF');
    resolving.add(i);
    const f=metadata.frames[i],m=f.m.clone();
    if(f.parent>=0)m.premultiply(frameMatrix(f.parent));
    resolving.delete(i);matrices[i]=m;return m;
  }
  const result=new THREE.Group();result.name='DFF · RenderWare';
  let used=0;
  for(const a of metadata.atomics){
    const base=parts[a.geom],frame=metadata.frames[a.frame];
    if(!base||!frame)continue;
    const mesh=new THREE.Mesh(base.geometry.clone(),Array.isArray(base.material)?base.material.map(x=>x.clone()):base.material.clone());
    mesh.name=frame.name+' ['+a.geom+']';mesh.userData={atomicIndex:a.index,geometryIndex:a.geom,frameIndex:a.frame,originalName:frame.name};
    mesh.matrixAutoUpdate=false;
    mesh.matrix.copy(convert).multiply(frameMatrix(a.frame));
    mesh.matrixWorldNeedsUpdate=true;
    // Damage models remain available in the parts list but are hidden by default.
    if(/(_dam|_low|_lod)(_|$)/i.test(frame.name))mesh.visible=false;
    mesh.traverse(x=>{if(x.isMesh&&x.material){const mats=Array.isArray(x.material)?x.material:[x.material];for(const mat of mats){mat.side=THREE.DoubleSide; if(mat.map)mat.map.colorSpace=THREE.SRGBColorSpace;}}});
    result.add(mesh);used++;
  }
  if(!used)throw Error('Nie znaleziono widocznych atomików DFF.');
  // 0..1 green channel is not a GTA:SA environment shader. Renderer uses a neutral base.
  return {group:result,materials:dict,meta:{...metadata,atomicCount:used,txdDetails}};
}
