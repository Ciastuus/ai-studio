import * as THREE from 'three';
import { getRWInfo } from '../viewer-rw.js';
import { exportEditedDFF, makeNativeZIP } from '../viewer-native-export.js';

// Minimal RenderWare CLUMP with two parented frames and one atomic.
function chunk(type,data) {
 const h=new Uint8Array(12+data.length),v=new DataView(h.buffer);
 v.setUint32(0,type,true);v.setUint32(4,data.length,true);v.setUint32(8,0x1803ffff,true);
 h.set(data,12);return h;
}
function join(...parts){
 let out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0)),o=0;
 for(const p of parts){out.set(p,o);o+=p.length}return out;
}
function frameData(){
 const bytes=new Uint8Array(4+2*56),v=new DataView(bytes.buffer);
 v.setUint32(0,2,true);
 for(let f=0;f<2;f++){
  const o=4+f*56;for(let j=0;j<9;j++)v.setFloat32(o+j*4,j===0||j===4||j===8?1:0,true);
  v.setFloat32(o+36,f===1?1:0,true);
  v.setFloat32(o+40,f===1?2:0,true);
  v.setFloat32(o+44,f===1?3:0,true);
  v.setInt32(o+48,f===1?0:-1,true);v.setInt32(o+52,0,true);
 }
 return bytes;
}
const frameChunk=chunk(14,chunk(1,frameData()));
const atomicStruct=new Uint8Array(16),av=new DataView(atomicStruct.buffer);
av.setUint32(0,1,true);av.setUint32(4,0,true);av.setUint32(8,5,true);
const bytes=chunk(16,join(chunk(1,new Uint8Array(12)),frameChunk,chunk(26,new Uint8Array(0)),chunk(20,chunk(1,atomicStruct))));
const native=bytes.buffer,info=getRWInfo(native);
if(info.frames.length!==2||info.frames[1].rwOffset<0)throw Error('FrameList offsets are missing');
const convert=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1);
const rwWorld=info.frames[0].m.clone().multiply(info.frames[1].m);
const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
mesh.name='bonnet_ok [0]';mesh.userData.frameIndex=1;mesh.matrixAutoUpdate=false;
mesh.matrix.copy(convert).multiply(rwWorld);
const old=mesh.matrix.clone(),state=new Map([[mesh.uuid,{matrix:old,visible:true}]]);
const original=exportEditedDFF(native,[mesh],state);
if(original.changedFrames!==0||Buffer.compare(Buffer.from(original.dff),Buffer.from(native))!==0)throw Error('Unchanged DFF differs from source');
mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.matrixAutoUpdate=true;
mesh.position.x+=.75;mesh.updateMatrix();
const edited=exportEditedDFF(native,[mesh],state);
if(edited.changedFrames!==1)throw Error('Edited atomic not recognized');
const result=getRWInfo(edited.dff);
const pos=result.frames[1].m.elements;
if(Math.abs(pos[12]-1.75)>0.00001||pos[13]!==2||pos[14]!==3)throw Error('RW frame translation invalid');
if(result.frames[0].parent!==-1||result.atomics[0].frame!==1)throw Error('Atomic parenting damaged');
const fakeTxd=new Uint8Array([22,0,0,0,42,9,0,0]).buffer;
const output=makeNativeZIP({dff:native,txds:[{name:'sultan.txd',data:fakeTxd}],parts:[mesh],initialStates:state,paint:'#242930'});
if(output.report.changedFrames!==1||output.zip.length<200)throw Error('Native ZIP missing edited binary');
if(!Buffer.from(output.zip).includes(Buffer.from('sultan.txd')) || !Buffer.from(output.zip).includes(Buffer.from('sultan_lspd.dff')))throw Error('ZIP is missing DFF or TXD');
let errors=0;try{makeNativeZIP({dff:native,txds:[],parts:[mesh],initialStates:state})}catch(e){errors++}
if(errors!==1)throw Error('Missing TXD was not rejected');
console.log('PASS DFF: exact no-change round trip, modified RW frame, original atomic hierarchy, TXD in ZIP');
