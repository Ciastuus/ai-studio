import * as THREE from 'three';
import { getRWInfo } from '../viewer-rw.js';
import { attachPoliceDecalsToPanels, exportEditedDFF } from '../viewer-native-export.js';

function chunk(type,payload){
 const hdr=new Uint8Array(12+payload.length),dv=new DataView(hdr.buffer);
 dv.setUint32(0,type,true);dv.setUint32(4,payload.length,true);dv.setUint32(8,0x1803ffff,true);
 hdr.set(payload,12);return hdr;
}
function join(...items){
 const r=new Uint8Array(items.reduce((sum,x)=>sum+x.length,0));let i=0;
 for(const x of items){r.set(x,i);i+=x.length}return r;
}
const named=[
 ['sultan',-1,0,0,0],['chassis_dummy',0,0,0,0],
 ['bonnet_dummy',1,0,1,.3],['bonnet_ok',2,0,0,0],['lspd_hood',2,.31,0,.015],
 ['boot_dummy',1,0,-1,.2],['boot_ok',5,0,0,0],['lspd_trunk',5,-.24,0,.025]
];
function makeFixture(){
 const data=new Uint8Array(4+56*named.length),dv=new DataView(data.buffer);
 dv.setUint32(0,named.length,true);
 for(let i=0;i<named.length;i++){
  const [name,parent,x,y,z]=named[i],off=4+i*56;
  for(let j=0;j<9;j++)dv.setFloat32(off+4*j,[0,4,8].includes(j)?1:0,true);
  for(const [j,c]of [x,y,z].entries())dv.setFloat32(off+36+j*4,c,true);
  dv.setInt32(off+48,parent,true);
 }
 const frames=chunk(14,join(
   chunk(1,data),
   ...named.map(([name])=>chunk(3,chunk(0x253f2fe,new TextEncoder().encode(name+'\0'))))
 ));
 const mainStruct=new Uint8Array(12),clump=chunk(16,join(chunk(1,mainStruct),frames,chunk(26,new Uint8Array(0))));
 return clump.buffer;
}
const source=makeFixture(),data=getRWInfo(source),ids=new Map(data.frames.map((f,i)=>[f.name,i]));
function world(info,i,cache=new Map()){
 if(cache.has(i))return cache.get(i);
 const f=info.frames[i],w=f.parent<0?f.m.clone():world(info,f.parent,cache).clone().multiply(f.m);
 cache.set(i,w);return w;
}
function eq(a,b,label){
 if(a.elements.some((v,i)=>Math.abs(v-b.elements[i])>1e-5))throw Error(label);
}
const p1=attachPoliceDecalsToPanels(source);
if(p1.attached.length!==2)throw Error('Expected both panel decals to be reparented');
const actual=getRWInfo(p1.dff);
for(const [word,panel] of [['lspd_hood','bonnet_ok'],['lspd_trunk','boot_ok']]){
 const wi=ids.get(word),pi=ids.get(panel);
 if(actual.frames[wi].parent!==pi)throw Error(word+' still belongs to dummy rather than '+panel);
 eq(world(data,wi),world(actual,wi),word+' moved after reparent!');
 // Simulate an opening panel in the live GTA vehicle.
 const angle=new THREE.Matrix4().makeRotationZ(.55),next=actual.frames[pi].m.clone().premultiply(angle);
 const originalWorld=world(actual,wi),panelBefore=world(actual,pi);
 const changed=getRWInfo(p1.dff);
 changed.frames[pi].m=next;
 const movingPanel=world(changed,pi),movingDecal=world(changed,wi);
 const expected=movingPanel.clone().multiply(panelBefore.clone().invert()).multiply(originalWorld);
 eq(movingDecal,expected,word+' does not follow opening panel!');
}
// Exporter must perform the repair automatically when given an old DFF.
const updated=exportEditedDFF(source,[],new Map());
if(updated.attachedDecals.length!==2)throw Error('Native export did not attach decals');
const unchanged=attachPoliceDecalsToPanels(p1.dff);
if(unchanged.attached.length||Buffer.compare(Buffer.from(unchanged.dff),Buffer.from(p1.dff)))throw Error('Applying fix twice changes DFF');
console.log('PASS: bonnet/trunk POLICE parented to moving panels, world position preserved, follows hinge rotation, idempotent');
