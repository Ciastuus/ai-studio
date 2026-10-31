import * as THREE from 'three';
import { zipStore, patchTXD, encodeDXT3 } from './native-export.js';
import { getRWInfo } from './viewer-rw.js';

const convert = new THREE.Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
const inverseConvert = convert.clone().invert();
const almostEqual = (a,b,epsilon=0.000002) => a.elements.every((v,i)=>Math.abs(v-b.elements[i]) <= epsilon);


/**
 * Permanently remove chosen atomic instances from the RenderWare CLUMP.
 * Retain geometry/frames (other components can reuse them), patch the clump
 * atomic count and root chunk size. This is a REAL DFF edit, not visibility.
 */
export function removeAtomicChunksDFF(input, atomicIndices) {
  const selected=new Set(Array.from(atomicIndices||[],Number));
  if(!selected.size)return {dff:input,removed:0};
  if(!(input instanceof ArrayBuffer))throw Error('Niepoprawny DFF');
  const view=new DataView(input),size=input.byteLength;
  if(size<64||view.getUint32(0,true)!==0x10)throw Error('DFF nie zawiera struktury CLUMP');
  const rootLen=view.getUint32(4,true),end=12+rootLen;
  if(end>size)throw Error('Niekompletna długość CLUMP');
  const source=new Uint8Array(input),parts=[];
  let p=12,atomIndex=0,atomicCount=0,structOffset=-1,structCount=-1,removed=0;
  while(p+12<=end){
    const type=view.getUint32(p,true),len=view.getUint32(p+4,true),next=p+12+len;
    if(next>end||next<=p)throw Error('Niepoprawny blok RenderWare');
    if(type===1 && structOffset<0){
      if(len<12)throw Error('Nieznany format nagłówka CLUMP');
      structOffset=p+12;structCount=view.getUint32(structOffset,true);
    }
    if(type===0x14){
      atomicCount++;
      if(selected.has(atomIndex)){removed++;atomIndex++;p=next;continue;}
      atomIndex++;
    }
    parts.push(source.subarray(p,next));p=next;
  }
  if(p!==end||structOffset<0||structCount!==atomicCount)throw Error('Niespójna liczba atomików DFF');
  if([...selected].some(x=>!Number.isInteger(x)||x<0||x>=atomicCount)||removed!==selected.size)
    throw Error('Próba usunięcia nieistniejącej części DFF');
  if(removed===atomicCount)throw Error('Nie można usunąć wszystkich atomików modelu');
  const childrenLength=parts.reduce((n,x)=>n+x.byteLength,0);
  const tail=source.subarray(end);
  const out=new Uint8Array(12+childrenLength+tail.length);
  out.set(source.subarray(0,12),0);
  let dest=12;
  for(const part of parts){out.set(part,dest);dest+=part.length;}
  out.set(tail,dest);
  const result=new DataView(out.buffer);
  result.setUint32(4,childrenLength,true);
  result.setUint32(structOffset,atomicCount-removed,true); // first CLUMP STRUCT chunk is kept at the same offset
  return {dff:out.buffer,removed};
}


/**
 * GTA:SA bonnet/boot animations move bonnet_ok/boot_ok model frames.
 * A POLICE decal attached as a *sibling* under bonnet_dummy/boot_dummy can
 * stay in place when the body panel animates or deforms. Reparent the label
 * underneath the actual animated panel, preserving its absolute placement.
 *
 * Runs after edited transforms are written. Other DFF structures and TXD are
 * untouched; compatible with both older (sibling) and already-fixed files.
 */
export function attachPoliceDecalsToPanels(source) {
 if(!(source instanceof ArrayBuffer))throw Error('Niepoprawny bufor DFF');
 const info=getRWInfo(source),byName=new Map();
 info.frames.forEach((f,i)=>byName.set(f.name.toLowerCase(),i));
 const rules=[['lspd_hood','bonnet_ok'],['lspd_trunk','boot_ok']];
 const work=source.slice(0),dv=new DataView(work),applied=[];
 const cache=new Map(),visiting=new Set();
 function worldOf(id){
   if(cache.has(id))return cache.get(id);
   if(visiting.has(id))throw Error('Cykl w hierarchii ramek DFF');
   visiting.add(id);
   const f=info.frames[id],local=f.m;
   const out=f.parent>=0?worldOf(f.parent).clone().multiply(local):local.clone();
   visiting.delete(id);cache.set(id,out);return out;
 }
 for(const [decName,parentName] of rules){
   const dec=byName.get(decName),parent=byName.get(parentName);
   if(dec===undefined||parent===undefined)continue; // other vehicles
   const frame=info.frames[dec];
   if(frame.parent===parent)continue;
   if(dec===parent)throw Error('Niedozwolony cykl ramki '+decName);
   // Resolve both original global transforms before editing either parent.
   const wantedWorld=worldOf(dec),newParentWorld=worldOf(parent);
   const relative=newParentWorld.clone().invert().multiply(wantedWorld);
   if(!relative.elements.every(Number.isFinite))throw Error('Niepoprawna transformacja '+decName);
   const off=frame.rwOffset;
   if(!Number.isInteger(off)||off<0||off+56>work.byteLength)throw Error('Niepoprawna pozycja ramki '+decName);
   const e=relative.elements,rot=[e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]];
   for(let j=0;j<9;j++)dv.setFloat32(off+j*4,rot[j],true);
   for(let j=0;j<3;j++)dv.setFloat32(off+36+j*4,e[12+j],true);
   dv.setInt32(off+48,parent,true);
   applied.push({decal:decName,parent:parentName});
 }
 return {dff:applied.length?work:source,attached:applied};
}

/** Write edited component transforms to the real DFF RenderWare FrameList. */
export function exportEditedDFF(originalDFF, parts, initialStates, removedAtomicIndices=[]) {
  if (!(originalDFF instanceof ArrayBuffer)) throw Error('Potrzebny jest bazowy plik DFF.');
  const info=getRWInfo(originalDFF);
  const changes=new Map(),names=[],skipped=[];
  const removedSet=new Set(removedAtomicIndices);
  for(const mesh of parts){
    if(!mesh.isMesh)continue;
    const frame=mesh.userData.frameIndex,before=initialStates.get(mesh.uuid);
    if(!Number.isInteger(frame)||frame<0||frame>=info.frames.length||!before)continue;
    if(removedSet.has(mesh.userData.atomicIndex))continue;
    if(mesh.matrixAutoUpdate)mesh.updateMatrix();
    if(almostEqual(mesh.matrix,before.matrix)){
      if(mesh.visible!==before.visible)skipped.push(mesh.name+' (widoczność)');
      continue;
    }
    const target=inverseConvert.clone().multiply(mesh.matrix);
    if(!target.elements.every(Number.isFinite))throw Error('Niepoprawna macierz części: '+mesh.name);
    if(Math.abs(target.determinant())<1e-9)throw Error('Zerowa skala części: '+mesh.name);
    const current=changes.get(frame);
    if(current&&!almostEqual(current.target,target))throw Error('Dwie części używają tej samej ramki i mają różne transformacje: '+mesh.name);
    changes.set(frame,{target,name:mesh.name});names.push(mesh.name);
    if(mesh.visible!==before.visible)skipped.push(mesh.name+' (widoczność)');
  }
  const saved=originalDFF.slice(0),view=new DataView(saved);
  const resolved=new Map(),resolving=new Set(),newLocal=new Map();
  function readWorld(id){
    if(resolved.has(id))return resolved.get(id);
    if(resolving.has(id))throw Error('Uszkodzony cykl ramek DFF');
    resolving.add(id);
    const frame=info.frames[id],parent=frame.parent;
    const parentMatrix=parent>=0?readWorld(parent):new THREE.Matrix4();
    const explicit=changes.get(id);
    const world=explicit?explicit.target:parentMatrix.clone().multiply(frame.m);
    const local=parentMatrix.clone().invert().multiply(world);
    newLocal.set(id,local);
    resolving.delete(id);resolved.set(id,world);return world;
  }
  for(let i=0;i<info.frames.length;i++)readWorld(i);
  for(const [id,local] of newLocal){
    if(almostEqual(local,info.frames[id].m,0.0000001))continue;
    const off=info.frames[id].rwOffset;
    if(!Number.isInteger(off)||off<0||off+56>saved.byteLength)throw Error('Brak pozycji ramki w DFF: '+id);
    const e=local.elements,rotation=[e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]];
    for(let j=0;j<9;j++)view.setFloat32(off+4*j,rotation[j],true);
    for(let j=0;j<3;j++)view.setFloat32(off+36+j*4,e[12+j],true);
  }
  const attached=attachPoliceDecalsToPanels(saved);
  const filtered=removeAtomicChunksDFF(attached.dff,removedAtomicIndices);
  return {dff:filtered.dff,attachedDecals:attached.attached,removedAtomics:filtered.removed,changedFrames:changes.size,changedNames:[...new Set(names)],omitted:skipped};
}

export function makeNativeZIP({dff,txds,parts,initialStates,paint,dffName='sultan_lspd.dff',doorAtlas=null,removedAtomicIndices=[]}){
  if(!dff||!Array.isArray(txds)||txds.length===0)throw Error('Najpierw wczytaj bazowy DFF i TXD.');
  const built=exportEditedDFF(dff,parts,initialStates,removedAtomicIndices);
  const names=new Set(),safeDff=dffName.split(/[\\/]/).pop();
  if(!/^[\w.()-]+\.dff$/i.test(safeDff))throw Error('Niepoprawna nazwa DFF');
  const files=[['files/'+safeDff,new Uint8Array(built.dff)]];
  const encoded=doorAtlas?.dirty?encodeDXT3(doorAtlas.texels):null;
  let editedTXD=0;
  for(const {name,data} of txds){
    if(!(data instanceof ArrayBuffer))throw Error('Niepoprawny TXD: '+name);
    const safe=name.split(/[\\/]/).pop();
    if(!/^[\w.()-]+\.txd$/i.test(safe))throw Error('Niepoprawna nazwa TXD: '+name);
    if(names.has(safe.toLowerCase()))throw Error('Duplikat TXD: '+name);
    names.add(safe.toLowerCase());
    let binary=new Uint8Array(data);
    if(encoded){
      try{binary=patchTXD(data,encoded);editedTXD++;}
      catch(e){if(!String(e.message).includes('Brakuje atlasu mrplspddoors512'))throw e;}
    }
    files.push([(safe.toLowerCase()==='vehicle.txd'?'optional/':'files/')+safe,binary]);
  }
  if(encoded&&editedTXD!==1)throw Error('Nie znaleziono jednego zgodnego TXD z atlasem drzwi.');
  const paintHex=/^#[a-f0-9]{6}$/i.test(paint||'')?paint:'#242930';
  const rgb=[1,3,5].map(i=>parseInt(paintHex.slice(i,i+2),16));
  const summary='M-RP DFF / TXD - eksport z RenderWare Viewer\r\n\r\n'
   +'Zmodyfikowane ramki DFF: '+built.changedFrames+'\r\n'
   +'Trwale usuniete atomiki DFF: '+built.removedAtomics+'\r\n'
   +'Przypiete POLICE do bonnet_ok/boot_ok: '+built.attachedDecals.map(x=>x.decal).join(', ')+'\r\n'
   +'Zmodyfikowane czesci: '+(built.changedNames.join(', ')||'brak zmian')+'\r\n'
   +'TXD: '+(editedTXD?'nowe LS, herby i PD wypalone w DXT3.':'oryginalne tekstury bez zmian.')+'\r\n'
   +'Lakier GTA:SA to dynamiczny remap. Kolor ustaw w Lua:\r\n'
   +'setVehicleColor(vehicle, '+rgb.join(', ')+', '+rgb.join(', ')+')\r\n\r\n'
   +'UWAGA: przesuniecia, obroty i skala sa zapisane do FrameList DFF. '
   +'Usuwanie czesci przez przycisk Usun czesc z DFF jest trwale. '
   +'Zwykla widocznosc i zmiany kolorow/materialow w podgladzie '
   +'nie zmieniaja DFF/TXD. vehicle.txd jest w optional/ i nie powinien zastepowac '
   +'pliku wspoldzielonego przez GTA. Przetestuj model w MTA:SA przed wdrozeniem.\r\n';
  files.push(['README.txt',summary]);
  files.push(['model-edits.json',JSON.stringify({format:'MRP-Viewer-NativeExport-v1',paint:paintHex,modified:built.changedNames,skippedVisibility:built.omitted,attachedDecals:built.attachedDecals,removedAtomicIndices:[...removedAtomicIndices],editedTXD,decals:doorAtlas?.state||[]},null,2)]);
  return {zip:zipStore(files),report:{...built,editedTXD}};
}