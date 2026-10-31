import * as THREE from 'three';
import { zipStore } from './native-export.js';
import { getRWInfo } from './viewer-rw.js';

const convert = new THREE.Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
const inverseConvert = convert.clone().invert();
const almostEqual = (a,b,epsilon=0.000002) => a.elements.every((v,i)=>Math.abs(v-b.elements[i]) <= epsilon);

/** Write edited component transforms to the real DFF RenderWare FrameList. */
export function exportEditedDFF(originalDFF, parts, initialStates) {
  if (!(originalDFF instanceof ArrayBuffer)) throw Error('Potrzebny jest bazowy plik DFF.');
  const info=getRWInfo(originalDFF);
  const changes=new Map(),names=[],skipped=[];
  for(const mesh of parts){
    if(!mesh.isMesh)continue;
    const frame=mesh.userData.frameIndex,before=initialStates.get(mesh.uuid);
    if(!Number.isInteger(frame)||frame<0||frame>=info.frames.length||!before)continue;
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
  return {dff:saved,changedFrames:changes.size,changedNames:[...new Set(names)],omitted:skipped};
}

export function makeNativeZIP({dff,txds,parts,initialStates,paint,dffName='sultan_lspd.dff'}){
  if(!dff||!Array.isArray(txds)||txds.length===0)throw Error('Najpierw wczytaj bazowy DFF i TXD.');
  const built=exportEditedDFF(dff,parts,initialStates);
  const names=new Set(),safeDff=dffName.split(/[\\/]/).pop();
  if(!/^[\w.()-]+\.dff$/i.test(safeDff))throw Error('Niepoprawna nazwa DFF');
  const files=[['files/'+safeDff,new Uint8Array(built.dff)]];
  for(const {name,data} of txds){
    if(!(data instanceof ArrayBuffer))throw Error('Niepoprawny TXD: '+name);
    const safe=name.split(/[\\/]/).pop();
    if(!/^[\w.()-]+\.txd$/i.test(safe))throw Error('Niepoprawna nazwa TXD: '+name);
    if(names.has(safe.toLowerCase()))throw Error('Duplikat TXD: '+name);
    names.add(safe.toLowerCase());
    files.push([(safe.toLowerCase()==='vehicle.txd'?'optional/':'files/')+safe,new Uint8Array(data)]);
  }
  const paintHex=/^#[a-f0-9]{6}$/i.test(paint||'')?paint:'#242930';
  const rgb=[1,3,5].map(i=>parseInt(paintHex.slice(i,i+2),16));
  const summary='M-RP DFF / TXD - eksport z RenderWare Viewer\r\n\r\n'
   +'Zmodyfikowane ramki DFF: '+built.changedFrames+'\r\n'
   +'Zmodyfikowane czesci: '+(built.changedNames.join(', ')||'brak zmian')+'\r\n'
   +'TXD: oryginalne pliki przeniesione bez zmiany tekstur.\r\n'
   +'Lakier GTA:SA to dynamiczny remap. Kolor ustaw w Lua:\r\n'
   +'setVehicleColor(vehicle, '+rgb.join(', ')+', '+rgb.join(', ')+')\r\n\r\n'
   +'UWAGA: przesuniecia, obroty i skala sa zapisane do FrameList DFF. '
   +'Ukrywanie/pokazywanie czesci oraz zmiany kolorow/materialow w podgladzie '
   +'nie zmieniaja DFF/TXD. vehicle.txd jest w optional/ i nie powinien zastepowac '
   +'pliku wspoldzielonego przez GTA. Przetestuj model w MTA:SA przed wdrozeniem.\r\n';
  files.push(['README.txt',summary]);
  files.push(['model-edits.json',JSON.stringify({format:'MRP-Viewer-NativeExport-v1',paint:paintHex,modified:built.changedNames,skippedVisibility:built.omitted},null,2)]);
  return {zip:zipStore(files),report:built};
}