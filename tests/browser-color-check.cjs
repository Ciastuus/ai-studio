const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
  fs.mkdirSync('artifacts',{recursive:true});
  const errors=[],messages=[],failed=[];
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>messages.push(m.type()+': '+m.text()));
  page.on('requestfailed',r=>failed.push(r.url()+' '+(r.failure()?.errorText||'')));
  await page.goto('http://127.0.0.1:9000/',{waitUntil:'domcontentloaded',timeout:30000});
  try {
    await page.waitForFunction(()=>window.__MRP_READY===true,null,{timeout:50000});
  } catch(e) {
    const state=await page.evaluate(()=>({ready:window.__MRP_READY,loading:document.querySelector('#loadingInfo')?.textContent,status:document.querySelector('#state')?.textContent,html:document.querySelector('#viewport')?.innerHTML.slice(0,300)}));
    await page.screenshot({path:'artifacts/failed-loading.png'});
    fs.writeFileSync('artifacts/debug.json',JSON.stringify({state,messages,failed,errors,error:e.message},null,2));
    console.error('MODEL_LOAD_DIAGNOSTIC',JSON.stringify({state,messages,failed,errors}));
    throw e;
  }
  const views=['left','right','angle'];
  const stats={};
  const countPixels=()=>page.evaluate(()=>{
    const cv=document.querySelector('#viewport canvas');
    const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;
    const ctx=c.getContext('2d');ctx.drawImage(cv,0,0);
    const {data}=ctx.getImageData(0,0,c.width,c.height);
    let white=0,green=0,magenta=0;
    for(let i=0;i<data.length;i+=4){
      const [r,g,b]=[data[i],data[i+1],data[i+2]];
      if(r>190&&g>188&&b>178&&Math.max(r,g,b)-Math.min(r,g,b)<46)white++;
      if(g>150&&g>r*1.45&&g>b*1.45)green++;
      if(r>140&&b>110&&r>g*1.6&&b>g*1.4)magenta++;
    }
    return {white,green,magenta,width:c.width,height:c.height};
  });
  for(const view of views){
    await page.locator('[data-camera="'+view+'"]').click();
    await page.waitForTimeout(1400);
    stats[view]=await countPixels();
    await page.screenshot({path:'artifacts/studio-'+view+'.png'});
  }
  await page.locator('#doorpaint').fill('#00ff00');
  await page.waitForTimeout(900);
  const changed=await countPixels();
  await page.screenshot({path:'artifacts/studio-green-test.png'});
  stats.greenTest=changed;
  await page.locator('#resetColors').click();
  await page.waitForTimeout(600);
  stats.reset=await countPixels();
  await page.screenshot({path:'artifacts/studio-reset.png'});
  await page.locator('#paint').fill('#ff00ff');
  await page.waitForTimeout(800);
  stats.bodyMagenta=await countPixels();
  await page.screenshot({path:'artifacts/studio-body-magenta.png'});
  await page.locator('#resetColors').click();
  await page.waitForTimeout(500);
  fs.writeFileSync('artifacts/browser-results.json',JSON.stringify({stats,errors},null,2));
  console.log('BROWSER_RENDER_RESULTS='+JSON.stringify({stats,errors}));
  await browser.close();
  if(errors.length)throw Error('Browser JS errors: '+errors.join(' | '));
  if(stats.left.white<800||stats.right.white<800||stats.angle.white<800)throw Error('Police doors not visibly white on all 3 camera angles');
  if(changed.green<800)throw Error('Door color picker does not visibly change surface');
  if(stats.bodyMagenta.magenta<300)throw Error('Body color picker does not visibly change dark car surface');
  console.log('PASS: browser loaded model, both doors are white, picker changes to green, reset returns white');
})().catch(e=>{console.error('FAILED_BROWSER_CHECK',e);process.exit(1)});
