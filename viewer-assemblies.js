import * as THREE from 'three';
/**
 * GTA:SA bonnet_dummy and boot_dummy drive the panel and its police decal.
 * In the viewer every DFF atomic is an independent mesh. Transforming only
 * bonnet_ok leaves lspd_hood floating in the old spot. Mirror that parent
 * motion onto child atomics while preserving independent decal editing.
 */
const pairs={
 bonnet_ok:['lspd_hood','bonnet_dam'],
 boot_ok:['lspd_trunk','boot_dam'],
};
export const baseName=mesh=>String(mesh?.userData?.originalName||mesh?.name||'').replace(/\s*\[\d+\]$/,'').toLowerCase();
export function mountFollowers(parts,primary){
 const names=pairs[baseName(primary)]||[];
 return parts.filter(other=>other!==primary&&names.includes(baseName(other)));
}
export function worldMatrixOf(node){
 node.updateWorldMatrix(true,false);return node.matrixWorld.clone();
}
export function propagateMountedTransform(primary,followers,previous){
 if(!primary||!followers?.length)return previous;
 primary.updateWorldMatrix(true,false);
 const current=primary.matrixWorld.clone();
 const delta=current.clone().multiply(previous.clone().invert());
 if(delta.elements.every((x,i)=>Math.abs(x-(i%5===0?1:0))<1e-10))return current;
 for(const other of followers){
  other.updateWorldMatrix(true,false);
  const desiredWorld=delta.clone().multiply(other.matrixWorld);
  const parentWorld=other.parent?worldMatrixOf(other.parent):new THREE.Matrix4();
  const next=parentWorld.invert().multiply(desiredWorld);
  other.matrixAutoUpdate=false;other.matrix.copy(next);next.decompose(other.position,other.quaternion,other.scale);
  other.matrixWorldNeedsUpdate=true;
 }
 return current;
}
