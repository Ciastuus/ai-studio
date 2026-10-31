import * as THREE from 'three';
import { isVehicleRemapMaterial, isReducedOrDamagedVehiclePart, normalizeVehicleMaterials, wheelDummyTargets } from '../viewer-rw.js';

const raw=new THREE.MeshStandardMaterial({color:new THREE.Color(60/255,1,0)});
const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),raw);
if(!isVehicleRemapMaterial(raw))throw Error('GTA SA green remap was not detected');
if(normalizeVehicleMaterials(mesh)!==1)throw Error('Vehicle remap material not recolored');
if(mesh.material.color.getHexString()!=='242930')throw Error('Wrong vehicle paint: '+mesh.material.color.getHexString());
if(!mesh.material.userData.vehiclePaint)throw Error('Vehicle paint material not tagged');
const actualGreen=new THREE.MeshStandardMaterial({color:0x00ff00});
if(isVehicleRemapMaterial(actualGreen))throw Error('Generic fully green material should not be recolored');
for(const name of ['chassis_vlo','door_rf_dam','boot_dam','foo_lod','foo_low']){
 if(!isReducedOrDamagedVehiclePart(name))throw Error('LOD/damage part visible: '+name);
}
for(const name of ['chassis','door_rf_ok','wheel','lspd_door_lf']){
 if(isReducedOrDamagedVehiclePart(name))throw Error('Valid model part hidden: '+name);
}
console.log('PASS: GTA SA vehicle remap paint, LOD/damage detection');

const demoFrames=['chassis_dummy','wheel_rf_dummy','wheel_lf_dummy','wheel_rb_dummy','wheel_lb_dummy','door_lf_dummy'].map(name=>({name}));
const targets=wheelDummyTargets(demoFrames);
if(targets.length!==4)throw Error('DFF wheel geometry was not expanded to four GTA:SA wheel dummy positions');
const actual=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:new THREE.Color(60/255,1,0)}));
actual.material.map=new THREE.Texture(); // texture without image (vehicle.txd not uploaded)
normalizeVehicleMaterials(actual);
if(actual.material.map)throw Error('Unresolved vehicle remap texture should not hide paint');
console.log('PASS: Four wheel dummy transforms, missing shared TXD fallback');
