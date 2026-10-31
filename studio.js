import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const stage=$('viewport'), status=$('state'), loading=$('loading'), loadingInfo=$('loadingInfo');
const scene=new THREE.Scene();scene.background=new THREE.Color('#26333f');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
stage.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,1,.03,70);camera.position.set(-5.8,2.9,-5.5);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,.12,0);orbit.enableDamping=true;orbit.dampingFactor=.075;
orbit.minDistance=2.4;orbit.maxDistance=16;orbit.maxPolarAngle=Math.PI*.88;
scene.add(new THREE.HemisphereLight(0xebf5ff,0x33404a,2.7));
const sun=new THREE.DirectionalLight(0xffffff,2.25);sun.position.set(-3,6,-4);scene.add(sun);
const fill=new THREE.DirectionalLight(0xa6c8e0,1.1);fill.position.set(5,3,3);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:'#303b48',roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.83;scene.add(floor);
const grid=new THREE.GridHelper(16,32,0x4b657b,0x394b5b);grid.position.y=-.827;scene.add(grid);
const car=new THREE.Group(),decals=new THREE.Group();scene.add(car,decals);
const wheelOverlays=[];
const tireMat=new THREE.MeshBasicMaterial({color:0x202429,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
const rimMat=new THREE.MeshBasicMaterial({color:0x9ca4aa,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
const spokeMat=new THREE.MeshBasicMaterial({color:0xcbd0d3,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
const hubMat=new THREE.MeshBasicMaterial({color:0x31373c,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false});
function makeEditableWheel(side,z){
  const face=new THREE.Group();
  face.rotation.y=side==='L'?-Math.PI/2:Math.PI/2;
  face.position.set(side==='L'?-1.145:1.145,-.255,z);
  const torus=new THREE.Mesh(new THREE.TorusGeometry(.283,.060,7,24),tireMat);
  face.add(torus);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(.238,24),rimMat);
  disc.position.z=.005;face.add(disc);
  const inset=new THREE.Mesh(new THREE.CircleGeometry(.173,24),hubMat);
  inset.position.z=.009;face.add(inset);
  for(let i=0;i<5;i++){
    const pivot=new THREE.Group();pivot.rotation.z=2*Math.PI*i/5;
    const spoke=new THREE.Mesh(new THREE.BoxGeometry(.068,.200,.014),spokeMat);
    spoke.position.set(0,.127,.018);pivot.add(spoke);face.add(pivot);
  }
  const center=new THREE.Mesh(new THREE.CircleGeometry(.049,16),rimMat);
  center.position.z=.028;face.add(center);
  face.traverse(o=>{if(o.isMesh)o.renderOrder=75});
  car.add(face);wheelOverlays.push({mesh:face,side});
}
for(const side of ['L','R'])for(const z of [-1.554,1.446])makeEditableWheel(side,z);
let loaded=false, editing=true, selected='lsL';
const dark='#242930',white='#efeee8';
const paintMeshes=[],doorMeshes=[],whiteSurfaces=[];
function mat(color,metalness=0,roughness=.82){return new THREE.MeshStandardMaterial({color,metalness,roughness,side:THREE.DoubleSide})}
const M={body:new THREE.MeshBasicMaterial({color:dark,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false}),doors:new THREE.MeshBasicMaterial({color:white,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false}),whiteShield:new THREE.MeshBasicMaterial({color:white,side:THREE.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false}),trim:mat('#11171c',0,.9),glass:new THREE.MeshStandardMaterial({color:0x394957,opacity:.7,transparent:true,roughness:.19,metalness:0,side:THREE.DoubleSide}),wheel:mat('#7f858b',.32,.5),tire:mat('#24272b',.08,.93),light:mat('#c6c9cc',.08,.76),plate:mat('#d4d8db',.05,.8)};
function ends(n){const m=n.match(/_(\d+)$/);return m?Number(m[1]):-1}
function materialsFor(obj){const n=obj.name.toLowerCase();const idx=ends(n);
  if(n.startsWith('lspd_door_')){
    // The DFF LSPD skins are genuinely outside the body. Some GLB materials still hide them,
    // so we rebuild a position-only, unlit protective overlay on their actual triangles.
    obj.visible=true;obj.material=M.doors;obj.renderOrder=6;doorMeshes.push(obj);
    const source=obj.geometry,geo=new THREE.BufferGeometry();
    geo.setAttribute('position',source.getAttribute('position').clone());
    if(source.index)geo.setIndex(source.index.clone());
    else {const ids=Array.from({length:source.getAttribute('position').count},(_,i)=>i);geo.setIndex(ids)}
    geo.computeVertexNormals();
    const left=n.startsWith('lspd_door_l');
    const protective=new THREE.Mesh(geo,M.whiteShield);
    protective.name='WHITE_LSPD_PANEL_'+n;
    protective.position.x=left?-.185:.185;
    protective.renderOrder=60;
    protective.frustumCulled=false;
    obj.add(protective);whiteSurfaces.push({mesh:protective,side:left?'L':'R'});
    return;
  }
  if(n.startsWith('lspd_lightbar')||n.startsWith('lspd_bar_')||n.startsWith('lspd_hood')||n.startsWith('lspd_trunk')){obj.visible=false;return}
  if(n.startsWith('wheel_23_0')){obj.material=M.tire;return}
  if(n.startsWith('wheel_23_1')){obj.material=M.wheel;return}
  if(n.includes('windscreen')){obj.material=M.glass;return}
  if(n.startsWith('door_lf_ok')||n.startsWith('door_rf_ok')){
    if([1,2,4].includes(idx)){obj.material=M.doors;doorMeshes.push(obj)}
    else if([0,3,5].includes(idx))obj.material=M.trim;
    return;
  }
  if(n.startsWith('door_lr_ok')||n.startsWith('door_rr_ok')){
    if([0,1,3].includes(idx)){obj.material=M.doors;doorMeshes.push(obj)}
    else obj.material=M.trim;
    return;
  }
  if(n.startsWith('plate_rear_ok')){obj.material=M.plate;return}
  // Use body paint only where the original mesh represents the outer shell.
  if(n.startsWith('bonnet_ok_1_0')||n.startsWith('boot_ok_3_0')||n.startsWith('sultan_roof')||n.startsWith('chassis_19_5')||n.startsWith('chassis_19_6')||n.startsWith('chassis_19_7')||n.startsWith('chassis_19_9')){
    obj.material=M.body;obj.renderOrder=0;paintMeshes.push(obj);return;
  }
  if(n.startsWith('bump_front_ok_9_0')||n.startsWith('bump_rear_ok_11_0')){obj.material=M.body;obj.renderOrder=0;paintMeshes.push(obj);return}
  if(n.startsWith('bump_front_ok_9_1')){obj.material=M.body;obj.renderOrder=0;paintMeshes.push(obj);return}
  // Keep original GTA textures on interior, fixtures and trim.
}
function canvasText(label){const cv=document.createElement('canvas');cv.width=512;cv.height=256;const c=cv.getContext('2d');
  c.clearRect(0,0,512,256);c.font='900 194px Arial Black,Arial';c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='#080c10';c.fillText(label,256,134,488);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function seal(){const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
  c.fillStyle='#13263d';c.beginPath();c.arc(256,256,231,0,Math.PI*2);c.fill();c.strokeStyle='#caab65';c.lineWidth=24;c.stroke();
  c.beginPath();c.arc(256,256,161,0,Math.PI*2);c.lineWidth=8;c.stroke();
  c.fillStyle='#e9d3a3';c.textAlign='center';c.textBaseline='middle';
  c.font='bold 47px Arial';c.fillText('LOS SANTOS',256,92);c.font='bold 30px Arial';c.fillText('POLICE DEPARTMENT',256,425);
  c.font='bold 190px serif';c.fillStyle='#dbba69';c.fillText('★',256,254);c.font='bold 50px Georgia';c.fillText('LSPD',256,344);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
const labelTex={ls:canvasText('LS'),pd:canvasText('PD'),badge:seal(),police:canvasText('POLICE')};
const config=[
  ['lsL','LS · kierowca',[-1.257,-.06,-.40],[.42,.29],'ls',-Math.PI/2],
  ['badgeL','Herb · kierowca',[-1.257,-.06,.02],[.29,.29],'badge',-Math.PI/2],
  ['pdL','PD · kierowca',[-1.257,-.06,.56],[.47,.30],'pd',-Math.PI/2],
  ['lsR','LS · pasażer',[1.257,-.06,-.40],[.42,.29],'ls',Math.PI/2],
  ['badgeR','Herb · pasażer',[1.257,-.06,.02],[.29,.29],'badge',Math.PI/2],
  ['pdR','PD · pasażer',[1.257,-.06,.56],[.47,.30],'pd',Math.PI/2],
  ['policeH','POLICE · maska',[0,.43,-1.80],[.7,.20],'police',0],
  ['policeT','POLICE · bagażnik',[0,.42,1.94],[.68,.19],'police',0],
  ['bar','Belka świetlna',[0,.73,-.05],[.9,.20],null,0]
];
const nodes=new Map(),defaults=new Map();
for(const [id,title,pos,dim,texture,rotY] of config){let node;
  if(id==='bar'){
    node=new THREE.Group();const base=new THREE.Mesh(new THREE.BoxGeometry(1.18,.055,.25),mat('#182129',.3,.56));base.position.y=-.075;node.add(base);
    for(const [x,col] of [[-.36,0x114de9],[.36,0xed263c]]){
      const lens=new THREE.Mesh(new THREE.BoxGeometry(.48,.12,.24),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.24,transparent:true,opacity:.91,roughness:.34}));lens.position.x=x;node.add(lens);}
  } else {
    const material=new THREE.MeshBasicMaterial({map:labelTex[texture],transparent:true,side:THREE.FrontSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-5});
    node=new THREE.Mesh(new THREE.PlaneGeometry(...dim),material);
    if(id.startsWith('police'))node.rotation.x=-Math.PI/2;
    else node.rotation.y=rotY;
  }
  if(id!=='bar'&&(id.startsWith('ls')||id.startsWith('pd')||id.startsWith('badge'))){node.material.depthTest=false;node.material.depthWrite=false;node.renderOrder=90;}
  node.position.set(...pos);node.userData.editorId=id;node.traverse(c=>c.userData.editorId=id);
  decals.add(node);nodes.set(id,node);defaults.set(id,{pos:[...pos],rot:0,scale:1});
}
function selectedNode(){return nodes.get(selected)}
function choose(id){if(!nodes.has(id))return;selected=id;for(const btn of document.querySelectorAll('[data-item]'))btn.classList.toggle('chosen',btn.dataset.item===id);$('selectedName').textContent=config.find(c=>c[0]===id)[1];syncInputs()}
function syncInputs(){const n=selectedNode();if(!n)return;for(const [key,v] of [['x',n.position.x],['y',n.position.y],['z',n.position.z],['scale',n.scale.x],['angle',THREE.MathUtils.radToDeg(n.userData.angle||0)]])$(key).value=+v.toFixed(3)}
for(const c of config){const b=document.createElement('button');b.textContent=c[1];b.dataset.item=c[0];b.onclick=()=>choose(c[0]);$('items').appendChild(b)}
for(const id of ['x','y','z'])$(id).addEventListener('change',e=>{const v=Number(e.target.value);if(Number.isFinite(v))selectedNode().position[id]=v});
$('scale').addEventListener('change',e=>{const v=Number(e.target.value);if(v>.1&&v<=3)selectedNode().scale.setScalar(v)});
$('angle').addEventListener('change',e=>{const v=Number(e.target.value);if(!Number.isFinite(v))return;const n=selectedNode(),a=THREE.MathUtils.degToRad(v),old=n.userData.angle||0;n.rotateZ(a-old);n.userData.angle=a});
for(const b of document.querySelectorAll('[data-nudge]'))b.addEventListener('click',()=>{const n=selectedNode();const side=selected.includes('R')||selected.includes('L');const d=b.dataset.nudge;if(d==='left')n.position.z-=.01;if(d==='right')n.position.z+=.01;if(d==='up')n.position.y+=.01;if(d==='down')n.position.y-=.01;if(!side&&(d==='up'||d==='down'))n.position.x+=d==='up'?.01:-.01;syncInputs()});
$('reset').onclick=()=>{const n=selectedNode(),d=defaults.get(selected);n.position.set(...d.pos);n.scale.setScalar(1);n.rotateZ(-(n.userData.angle||0));n.userData.angle=0;syncInputs()};
const views={left:[-6,1.2,0],right:[6,1.2,0],front:[0,1.4,-7],rear:[0,1.4,7],top:[0,8,.001],angle:[-5.8,2.9,-5.5]};
for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>{const xyz=views[b.dataset.camera];camera.position.set(...xyz);orbit.target.set(0,.1,0);orbit.update();document.querySelectorAll('[data-camera]').forEach(x=>x.classList.toggle('chosen',x===b))};
$('paint').oninput=e=>M.body.color.set(e.target.value);
$('doorpaint').oninput=e=>{M.doors.color.set(e.target.value);M.whiteShield.color.set(e.target.value)};
$('grid').onchange=e=>grid.visible=e.target.checked;
$('resetColors').onclick=()=>{M.body.color.set(dark);M.doors.color.set(white);M.whiteShield.color.set(white);M.whiteShield.color.set(white);$('paint').value=dark;$('doorpaint').value=white;try{const local=localStorage.getItem('mrp-lspd-studio-v2');if(local){const saved=JSON.parse(local);saved.paint=dark;saved.doorpaint=white;localStorage.setItem('mrp-lspd-studio-v2',JSON.stringify(saved))}}catch(e){console.warn(e)}};
$('editMode').onclick=()=>{editing=true;decals.visible=true;$('editMode').classList.add('on');$('previewMode').classList.remove('on')};
$('previewMode').onclick=()=>{editing=false;decals.visible=false;$('previewMode').classList.add('on');$('editMode').classList.remove('on')};
function snapshot(){const elements={};for(const [id,n] of nodes){elements[id]={x:n.position.x,y:n.position.y,z:n.position.z,scale:n.scale.x,rotation:THREE.MathUtils.radToDeg(n.userData.angle||0)}}return {format:'MRP-LSPD-3D-V2',model:'sultan_lspd_v10.glb',elements,paint:$('paint').value,doorpaint:$('doorpaint').value}}
function apply(s){if(s.format!=='MRP-LSPD-3D-V2'&&s.format!=='MRP-Sultan-LSPD-3D')throw Error('Nieobsługiwany format JSON');for(const [id,data] of Object.entries(s.elements||{})){const n=nodes.get(id);if(!n)continue;for(const k of ['x','y','z'])if(Number.isFinite(+data[k]))n.position[k]=+data[k];if(+data.scale>0)n.scale.setScalar(+data.scale);const a=THREE.MathUtils.degToRad(Number(data.rotation)||0);n.rotateZ(a-(n.userData.angle||0));n.userData.angle=a}if(s.paint){$('paint').value=s.paint;M.body.color.set(s.paint)}if(s.doorpaint){$('doorpaint').value=s.doorpaint;M.doors.color.set(s.doorpaint)}syncInputs()}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('save').onclick=()=>{const s=snapshot();localStorage.setItem('mrp-lspd-studio-v2',JSON.stringify(s));download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),'sultan_lspd_editor.json');$('savedNote').textContent='Ustawienia zapisano lokalnie i wyeksportowano do JSON.'};
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{try{if(e.target.files[0])apply(JSON.parse(await e.target.files[0].text()))}catch(error){alert('Błąd importu: '+error.message)}e.target.value=''};
$('screenshot').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(blob)download(blob,'sultan_lspd_3d.png')},'image/png')};
const pointer=new THREE.Vector2(),ray=new THREE.Raycaster(),movementPlane=new THREE.Plane();let dragged=false,startPoint=new THREE.Vector3(),startPos=new THREE.Vector3(),activePointer=null;
function locate(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera)}
renderer.domElement.addEventListener('pointerdown',e=>{if(!editing||e.button!==0||!loaded)return;locate(e);const hits=ray.intersectObjects([...nodes.values()],true);if(!hits.length)return;const id=hits[0].object.userData.editorId;if(!nodes.has(id))return;choose(id);dragged=true;activePointer=e.pointerId;orbit.enabled=false;const n=selectedNode();let norm=new THREE.Vector3();if(id==='bar'||id.startsWith('police'))norm.set(0,1,0);else norm.set(1,0,0);movementPlane.setFromNormalAndCoplanarPoint(norm,n.position);startPos.copy(n.position);ray.ray.intersectPlane(movementPlane,startPoint);renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!dragged||e.pointerId!==activePointer)return;locate(e);const pt=new THREE.Vector3();if(ray.ray.intersectPlane(movementPlane,pt)){selectedNode().position.copy(startPos).add(pt.sub(startPoint));syncInputs()}});
function endDrag(){dragged=false;activePointer=null;orbit.enabled=true}renderer.domElement.addEventListener('pointerup',endDrag);renderer.domElement.addEventListener('pointercancel',endDrag);
function resize(){const r=stage.getBoundingClientRect();if(r.width<2||r.height<2)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(stage);resize();choose('lsL');
let timedOut=false;const timeout=setTimeout(()=>{if(!loaded){timedOut=true;loadingInfo.textContent='Przekroczono czas wczytywania. Sprawdź połączenie internetowe i plik assets/sultan_lspd_v10.glb.';$('retry').hidden=false}},20000);
$('retry').onclick=()=>location.reload();
const loader=new GLTFLoader();loadingInfo.textContent='Pobieranie assets/sultan_lspd_v10.glb…';
loader.load('./assets/sultan_lspd_v10.glb',g=>{
  car.add(g.scene);let count=0,painted=0,doored=0;
  g.scene.traverse(o=>{if(!o.isMesh)return;count++;materialsFor(o)});painted=paintMeshes.length;doored=doorMeshes.length;
  loading.hidden=true;loaded=true;window.__MRP_READY=true;clearTimeout(timeout);status.textContent=`Model załadowany · ${count} siatek`; $('meshInfo').textContent=`${count} części · drzwi ${doored} · białe panele ${whiteSurfaces.length}`;
  try{const local=localStorage.getItem('mrp-lspd-studio-v2');if(local){const saved=JSON.parse(local);delete saved.paint;delete saved.doorpaint;apply(saved)}}catch(e){console.warn(e)}
  M.body.color.set(dark);M.doors.color.set(white);M.whiteShield.color.set(white);$('paint').value=dark;$('doorpaint').value=white;
},progress=>{if(progress.lengthComputable)loadingInfo.textContent=`Pobrano ${Math.round(progress.loaded/progress.total*100)}% modelu`;else loadingInfo.textContent='Pobieranie modelu 3D…'},err=>{clearTimeout(timeout);loadingInfo.textContent='Nie udało się pobrać modelu 3D: '+(err?.message||err);status.textContent='Błąd ładowania';$('retry').hidden=false;console.error(err)});
function frame(){
  requestAnimationFrame(frame);
  orbit.update();
  const positive=camera.position.x>.1,negative=camera.position.x<-.1;
  for(const item of whiteSurfaces)item.mesh.visible=(item.side==='R'?positive:negative);
  for(const item of wheelOverlays)item.mesh.visible=(item.side==='R'?positive:negative);
  for(const [id,node] of nodes){if(/^(ls|pd|badge)[LR]$/.test(id)){node.visible=id.endsWith('L')?negative:positive}}
  renderer.render(scene,camera);
}frame();
window.addEventListener('error',e=>{if(!loaded){loadingInfo.textContent=`Błąd JavaScript: ${e.message}`;$('retry').hidden=false}});
