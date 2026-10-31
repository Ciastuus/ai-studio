import * as THREE from 'three';
import { isVehicleRemapMaterial, isReducedOrDamagedVehiclePart, normalizeVehicleMaterials } from '../viewer-rw.js';

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
