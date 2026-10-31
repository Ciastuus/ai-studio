import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1420,height:870}});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/viewer.html',{waitUntil:'domcontentloaded',timeout:45000});
 await page.locator('[data-tab="decals"]').click();
 const count=await page.evaluate(async()=>{
   const {createDecalEditor}=await import('/viewer-decals.js');
   const rgba=new Uint8Array(512*512*4);
   for(let y=0;y<512;y++)for(let x=0;x<512;x++){
     const i=(y*512+x)*4;rgba.set([238,238,233,255],i);
   }
   const shapes=[[84,114,138,213],[179,100,221,214],[284,103,327,209],
      [372,114,446,213],[30,369,98,471],[408,368,465,469]];
   for(const [x1,y1,x2,y2] of shapes)for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++){
     const i=(y*512+x)*4;rgba.set([18,18,18,255],i);
   }
   const tex={image:{data:rgba,width:512,height:512},needsUpdate:false};
   const dict=new Map([['mrplspddoors512',{texture:tex}]]);
   window.__decalsTest=createDecalEditor(dict,{preview:'decalAtlas',select:'decalSelect',
     scale:'decalScale',rotation:'decalRotation',reset:'decalReset',help:'decalHelp'});
   if(!window.__decalsTest)throw Error('Decal editor creation failed');
   document.getElementById('decalControls').hidden=false;
   return document.querySelectorAll('#decalSelect option').length;
 });
 if(count!==6)throw Error('Expected six movable labels, got '+count);
 const a=await page.locator('#decalAtlas').boundingBox();
 const lx=x=>a.x+x/512*a.width,ly=y=>a.y+y/512*a.height;
 await page.mouse.move(lx(104),ly(158));await page.mouse.down();
 await page.mouse.move(lx(139),ly(177),{steps:10});await page.mouse.up();
 const after=await page.evaluate(()=>({
    dirty:window.__decalsTest.dirty,
    ls:window.__decalsTest.state.find(x=>x.id==='lsL'),
    pixels:window.__decalsTest.texels.length
 }));
 if(!after.dirty||after.ls.cx<140||after.pixels!==1048576)
   throw Error('Dragging text did not update TXD raster independently: '+JSON.stringify(after));
 await page.locator('#decalScale').fill('1.4');await page.locator('#decalScale').dispatchEvent('input');
 await page.locator('#decalRotation').fill('15');await page.locator('#decalRotation').dispatchEvent('input');
 const changed=await page.evaluate(()=>window.__decalsTest.state.find(x=>x.id==='lsL'));
 if(changed.scale!==1.4||changed.rotation!==15)throw Error('Scale/rotation controls failed');
 await page.locator('#decalReset').click();
 if(await page.evaluate(()=>window.__decalsTest.dirty))throw Error('Reset did not clear modified status');
 if(errors.length)throw Error(errors.join('\n'));
 await page.screenshot({path:'viewer-decals-smoke.png',fullPage:true});
 console.log('PASS: six independent TXD decals, pointer drag, scale, rotation, reset');
}finally{await browser.close()}
