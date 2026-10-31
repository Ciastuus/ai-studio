import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { nativeGroup } from './viewer-rw.js';

const $=id=>document.getElementById(id);
const stage=$('viewport'), scene=new THREE.Scene();scene.background=new THREE.Color('#101321');
const camera=new THREE.PerspectiveCamera(44,1,.01,600);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.32;renderer.setClearColor('#101321');
stage.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.dampingFactor=.08;orbit.minDistance=.5;orbit.maxDistance=200;
const hemi=new THREE.HemisphereLight(0xdbe8ff,0x343146,1.6),sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-4,9,5);
scene.add(hemi,sun);const floor=new THREE.GridHelper(18,36,0x3d4267,0x23283c),axes=new THREE.AxesHelper(2);
floor.position.y=-.82;axes.visible=false;scene.add(floor,axes);
const roots=new THREE.Group();scene.add(roots);
const transform=new TransformControls(camera,renderer.domElement);scene.add(transform);
transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);
transform.addEventListener('objectChange',()=>{if(selected)sync()});
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
let rootModel=null,selected=null,partMeshes=[],startState=new Map(),textureMap=new Map(),kind='—',nativeMeta=null;
let uploadedDFF=null, uploadedTXD=[],statusTimer=null,spinTimer=null,debounced=false;
const formatSize=b=>b==null?'—':b>=1048576?(b/1048576).toFixed(1)+' MB':(b/1024).toFixed(0)+' KB';
const escapeHTML=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;').replaceAll('>','&gt;');
function status(s){$('state').textContent=s}
function message(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(statusTimer);statusTimer=setTimeout(()=>$('toast').hidden=true,4400)}
function busy(title,desc=''){ $('loadingTitle').textContent=title;$('loadingMessage').textContent=desc;$('loading').hidden=false;$('retry').hidden=true;clearTimeout(spinTimer);spinTimer=setTimeout(()=>{if(!$('loading').hidden){$('loadingMessage').textContent='Wczytywanie trwa dłużej niż zwykle. Sprawdź pliki i połączenie.';$('retry').hidden=false}},18000) }
function ready(){clearTimeout(spinTimer);$('loading').hidden=true}
function fail(e){clearTimeout(spinTimer);$('loadingTitle').textContent='Nie udało się wczytać modelu';$('loadingMessage').textContent=e.message||String(e);$('retry').hidden=false;status('Błąd modelu');console.error(e)}
function download(data,filename,mime='application/octet-stream'){const blob=data instanceof Blob?data:new Blob([data],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500)}
function focusModel(){
 if(!rootModel)return;rootModel.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(rootModel);if(box.isEmpty())return;
 const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const radius=Math.max(size.length()/2,.6);
 orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(-radius*1.7,radius*.9,-radius*1.6));orbit.minDistance=Math.max(.1,radius*.35);orbit.maxDistance=radius*14;camera.near=Math.max(.005,radius/300);camera.far=Math.max(200,radius*30);camera.updateProjectionMatrix();
 floor.position.y=box.min.y-.03;axes.position.copy(center);axes.scale.setScalar(Math.max(.2,radius*.6));orbit.update();
}
function originalOf(mesh){return {pos:mesh.position.clone(),rot:mesh.quaternion.clone(),scale:mesh.scale.clone(),visible:mesh.visible,matrix:mesh.matrix.clone()}}
function selectable(o){return o.isMesh&&o.geometry?.attributes?.position?.count>0&&o.name&&!o.userData?.isEditorHelper}
function setModel(group,source,meta=null,textureDictionary=new Map()){
 selected=null;transform.detach();
 if(rootModel){roots.remove(rootModel);rootModel.traverse(o=>{if(o.geometry&&o.userData?.temporaryGeometry)o.geometry.dispose()})}
 rootModel=group;roots.add(rootModel);kind=source;nativeMeta=meta;textureMap=textureDictionary;
 partMeshes=[];startState.clear();group.traverse(o=>{if(selectable(o)){partMeshes.push(o);startState.set(o.uuid,originalOf(o))}});
 const totalV=partMeshes.reduce((n,x)=>n+x.geometry.attributes.position.count,0);
 const totalF=partMeshes.reduce((n,x)=>n+(x.geometry.index?x.geometry.index.count/3:x.geometry.attributes.position.count/3),0);
 const materialSet=new Set();partMeshes.forEach(mesh=>(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>materialSet.add(m.uuid)));
 $('verts').textContent=totalV.toLocaleString('pl-PL');$('tris').textContent=Math.round(totalF).toLocaleString('pl-PL');$('mats').textContent=materialSet.size.toLocaleString('pl-PL');$('partsCount').textContent=partMeshes.length;
 $('sourceKind').textContent=source;$('rwFormat').textContent=meta?'RenderWare 0x'+meta.version.toString(16).toUpperCase():'glTF / GLB';
 $('materialCount').textContent=materialSet.size;$('fileType').textContent=source==='DFF + TXD'?'NATYWNY':'GLB';
 $('selectedBadge').textContent='Brak zaznaczenia';
 $('meshInfo').textContent=undefined; // ignored in current viewer template
 const mats=[...materialSet].map(uuid=>{for(const m of partMeshes){let list=Array.isArray(m.material)?m.material:[m.material];let found=list.find(x=>x.uuid===uuid);if(found)return found}}).filter(Boolean);
 $('materialList').innerHTML=mats.map((m,i)=>'<div class="material-item"><span class="mat-color" style="background:#'+m.color?.getHexString?.()+'"></span><span>'+escapeHTML(m.name||('Materiał '+(i+1)))+(m.map?' · TXD':'')+'</span></div>').join('');
 focusModel();renderParts();renderTextures();ready();status(source+' · '+partMeshes.length+' części');message('Model wczytany: '+partMeshes.length+' części');
}
function renderParts(){const needle=$('partSearch').value.trim().toLowerCase(),target=$('partList');target.replaceChildren();
 let n=0;for(const mesh of partMeshes){if(needle&&!mesh.name.toLowerCase().includes(needle))continue;n++;
  const row=document.createElement('button');row.className='part-item'+(selected===mesh?' active':'');row.title=mesh.name;
  const eye=document.createElement('span');eye.className='eye'+(mesh.visible?'':' off');eye.textContent=mesh.visible?'◉':'◌';
  eye.onclick=e=>{e.stopPropagation();mesh.visible=!mesh.visible;eye.className='eye'+(mesh.visible?'':' off');eye.textContent=mesh.visible?'◉':'◌';if(selected===mesh)$('partVisible').checked=mesh.visible};
  row.append(eye);const label=document.createElement('span');label.className='partlabel';label.textContent=mesh.name;row.append(label);
  row.onclick=()=>choose(mesh);target.append(row);
 }
 if(!n)target.innerHTML='<p class="smallnote">Brak pasujących części.</p>';
}
function choose(mesh){selected=mesh;transform.detach();
 $('inspectEmpty').hidden=!!mesh;$('inspectFields').hidden=!mesh;
 if(!mesh){$('selectedBadge').textContent='Brak zaznaczenia';renderParts();return}
 if(!mesh.matrixAutoUpdate){mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.matrixAutoUpdate=true;}
 $('selectedBadge').textContent=mesh.name;
 $('partTitle').textContent=mesh.name;
 $('partVisible').checked=mesh.visible;
 transform.attach(mesh);transform.setMode('translate');$('moveMode').classList.add('active');$('rotateMode').classList.remove('active');$('scaleMode').classList.remove('active');sync();renderParts();
}
function sync(){if(!selected)return;for(const [id,x]of [['posX',selected.position.x],['posY',selected.position.y],['posZ',selected.position.z],['rotY',THREE.MathUtils.radToDeg(selected.rotation.y)],['scale',selected.scale.x]])$(id).value=Number(x.toFixed(3))}
for(const id of ['posX','posY','posZ','rotY','scale'])$(id).addEventListener('change',()=>{
 if(!selected)return;const n=Number($(id).value);if(!Number.isFinite(n))return;
 if(id==='posX')selected.position.x=n;if(id==='posY')selected.position.y=n;if(id==='posZ')selected.position.z=n;
 if(id==='rotY')selected.rotation.y=THREE.MathUtils.degToRad(n);if(id==='scale'&&n>0&&n<50)selected.scale.setScalar(n);sync();
});
$('partVisible').onchange=e=>{if(selected){selected.visible=e.target.checked;renderParts()}};
for(const [button,mode] of [['moveMode','translate'],['rotateMode','rotate'],['scaleMode','scale']])$(button).onclick=()=>{transform.setMode(mode);for(const id of ['moveMode','rotateMode','scaleMode'])$(id).classList.toggle('active',id===button)};
$('resetPart').onclick=()=>{if(!selected)return;const o=startState.get(selected.uuid);selected.position.copy(o.pos);selected.quaternion.copy(o.rot);selected.scale.copy(o.scale);selected.visible=o.visible;selected.updateMatrix();sync();renderParts()};
$('partSearch').oninput=renderParts;$('showAll').onclick=()=>{partMeshes.forEach(m=>m.visible=true);renderParts()};$('hideAll').onclick=()=>{partMeshes.forEach(m=>m.visible=false);renderParts()};
for(const [id,fn] of [['grid',v=>floor.visible=v],['axes',v=>axes.visible=v],['rotate',v=>orbit.autoRotate=v],['wire',v=>partMeshes.forEach(m=>(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>{x.wireframe=v}))],['lighting',v=>{hemi.intensity=v?Number($('ambient').value):2.4;sun.intensity=v?Number($('sun').value):0}]])$(id).onchange=e=>fn(e.target.checked);
$('ambient').oninput=e=>hemi.intensity=Number(e.target.value);$('sun').oninput=e=>sun.intensity=Number(e.target.value);
function renderTextures(){
 const list=$('textureList');list.replaceChildren();$('textureDetails').textContent='';
 if(!textureMap.size){list.innerHTML='<p class="smallnote">Wczytaj TXD, aby zobaczyć tekstury.</p>';return}
 for(const [name,entry]of textureMap){const tex=entry.texture||entry;const img=tex.image;if(!img)continue;
 const w=img.width||0,h=img.height||0;let url='';
 try{
  const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
  if(img.data&&img.data.length===w*h*4){const p=new Uint8ClampedArray(img.data);ctx.putImageData(new ImageData(p,w,h),0,0)}
  else ctx.drawImage(img,0,0,w,h);
  url=c.toDataURL('image/png');
 }catch(e){console.warn('TXD thumbnail',name,e)}
 const tile=document.createElement('button');tile.className='texture-card';tile.title=name;
 if(url){let thumb=new Image();thumb.src=url;tile.append(thumb)}
 let label=document.createElement('b');label.textContent=name;tile.append(label);
 let note=document.createElement('small');note.textContent=w+' × '+h;tile.append(note);
 tile.onclick=()=>{$('textureDetails').textContent=name+' · '+w+'×'+h+(entry.hasAlpha?' · alfa':'');if(url)downloadURL(url,name+'.png')};
 list.append(tile);
 }
}
function downloadURL(url,name){const a=document.createElement('a');a.download=name;a.href=url;a.click()}
function setCamera(key){if(!rootModel)return;const box=new THREE.Box3().setFromObject(rootModel),c=box.getCenter(new THREE.Vector3()),d=Math.max(box.getSize(new THREE.Vector3()).length()*1.15,1.5);
 const directions={left:[-1,.1,0],right:[1,.1,0],front:[0,.1,-1],rear:[0,.1,1],top:[0,1,.001],angle:[-1,.65,-1]};
 camera.position.copy(c).add(new THREE.Vector3(...directions[key]).normalize().multiplyScalar(d));orbit.target.copy(c);orbit.update();
 document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===key));
}
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setCamera(b.dataset.camera));
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
 const tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));
 document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('active',x.id==='tab-'+tab));
 $('viewMode').textContent=tab.toUpperCase()+' · '+(kind==='DFF + TXD'?'DFF / TXD':'GLB');
});
function resize(){const r=stage.getBoundingClientRect();if(r.width<2||r.height<2)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);
renderer.domElement.addEventListener('pointerdown',e=>{
 if(e.button!==0||!rootModel||transform.dragging)return;
 const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
 const hit=ray.intersectObjects(partMeshes.filter(m=>m.visible),false);
 if(hit.length){choose(hit[0].object);document.querySelector('[data-tab="view"]').click()}
});
function frame(){requestAnimationFrame(frame);orbit.update();renderer.render(scene,camera)}frame();
async function loadSample(){
 busy('Wczytywanie Sultana GLB','Model przykładowy z wcześniejszego edytora M-RP. Aby zobaczyć DFF/TXD, wybierz pliki.');
 try{
  const g=await new GLTFLoader().loadAsync('./assets/sultan_lspd_v10.glb');setModel(g.scene,'GLB (przykład)');
  $('dffName').textContent='sultan_lspd_v10.glb';$('dffSize').textContent='Przykład';
 }catch(e){fail(e)}
}
async function loadNativeFiles(){
 if(!uploadedDFF)return;
 busy('Wczytywanie natywnego DFF','Dekodowanie geometrii, materiałów i tekstur TXD.');await new Promise(r=>setTimeout(r,40));
 try{
  const model=nativeGroup(await uploadedDFF.arrayBuffer(),await Promise.all(uploadedTXD.map(async f=>({data:await f.arrayBuffer(),name:f.name}))));
  setModel(model.group,'DFF + TXD',model.meta,model.materials);
  $('dffName').textContent=uploadedDFF.name;$('dffSize').textContent=formatSize(uploadedDFF.size);
  $('txdName').textContent=uploadedTXD.map(x=>x.name).join(', ')||'Brak TXD';$('txdSize').textContent=uploadedTXD.length?formatSize(uploadedTXD.reduce((a,f)=>a+f.size,0)):'—';
 }catch(e){fail(e)}
}
async function acceptFiles(list){
 const files=Array.from(list);const dff=files.find(f=>/\.dff$/i.test(f.name)),txds=files.filter(f=>/\.txd$/i.test(f.name)),glb=files.find(f=>/\.(glb|gltf)$/i.test(f.name));
 if(dff)uploadedDFF=dff;
 if(txds.length){for(const f of txds){uploadedTXD=uploadedTXD.filter(t=>t.name.toLowerCase()!==f.name.toLowerCase());uploadedTXD.push(f)}}
 if(uploadedDFF){await loadNativeFiles();return}
 if(glb){busy('Wczytywanie GLB',glb.name);try{const data=await glb.arrayBuffer();const model=await new Promise((res,rej)=>new GLTFLoader().parse(data,'',res,rej));setModel(model.scene,'GLB (wczytany)');$('dffName').textContent=glb.name;$('dffSize').textContent=formatSize(glb.size)}catch(e){fail(e)}return}
 if(txds.length){$('txdName').textContent=txds.map(f=>f.name).join(', ');$('txdSize').textContent=formatSize(txds.reduce((s,f)=>s+f.size,0));message('Wczytano TXD. Dodaj teraz plik DFF.')}
}
$('filePicker').onchange=e=>{acceptFiles(e.target.files);e.target.value=''};
const drop=$('drop');window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');acceptFiles(e.dataTransfer.files)});
for(const type of ['dragenter','dragover'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('drag')});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
$('loadSample').onclick=loadSample;$('retry').onclick=()=>uploadedDFF?loadNativeFiles():loadSample();
$('savePNG').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>b&&download(b,'mrp-model-view.png','image/png'))};
$('saveJSON').onclick=()=>{const elements=partMeshes.map(m=>({name:m.name,originalName:m.userData.originalName||null,position:m.position.toArray(),quaternion:m.quaternion.toArray(),scale:m.scale.toArray(),visible:m.visible}));download(JSON.stringify({format:'MRP-Viewer-Transforms-v1',source:kind,info:'Transformations for viewer preview, not an edited DFF',elements},null,2),'mrp-viewer-transformations.json','application/json')};
$('saveGLB').onclick=()=>{if(!rootModel){message('Najpierw wczytaj model.');return}const visible=new THREE.Group();visible.add(rootModel.clone(true));new GLTFExporter().parse(visible,result=>{
 const b=result instanceof ArrayBuffer?result:JSON.stringify(result);download(b,'mrp-viewer-preview.'+(result instanceof ArrayBuffer?'glb':'gltf'),'application/octet-stream')
 },e=>{message(e.message||String(e));console.error(e)},{binary:true,onlyVisible:true})};
window.addEventListener('error',e=>{if(!$('loading').hidden)fail(e.error||Error(e.message))});
window.addEventListener('unhandledrejection',e=>{if(!$('loading').hidden)fail(e.reason instanceof Error?e.reason:new Error(String(e.reason)))});
loadSample();
