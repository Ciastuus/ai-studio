import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--disable-gpu-sandbox','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1365,height:860},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',err=>errors.push('PAGE ERROR: '+err.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE: '+msg.text())});
try{
 await page.goto('http://127.0.0.1:8765/viewer.html',{waitUntil:'domcontentloaded',timeout:40000});
 const preStatus=(await page.locator('#state').textContent())?.trim();
 if(!preStatus?.includes('DFF'))throw Error('Native import should be the default viewer state');
 await page.locator('#loadSample').click();
 await page.waitForFunction(()=>{
  const text=document.querySelector('#state')?.textContent||'';
  return text.includes('GLB')&&document.querySelectorAll('.part-item').length>0;
 },null,{timeout:45000});
 const count=await page.locator('.part-item').count();
 if(count<30)throw Error('Only '+count+' model parts loaded');
 await page.locator('.part-item').first().click();
 if(!(await page.locator('#inspectFields').isVisible()))throw Error('Inspector not visible after part selection');
 await page.locator('[data-tab="textures"]').click();
 if(!(await page.locator('#tab-textures').isVisible()))throw Error('Texture tab missing');
 await page.locator('[data-tab="model"]').click();
 if(!(await page.locator('#tab-model').isVisible()))throw Error('Model tab missing');
 await page.locator('[data-tab="view"]').click();
 await page.screenshot({path:'viewer-smoke.png'});
 if(errors.some(e=>e.startsWith('PAGE ERROR')))throw Error(errors.join('\n'));
 console.log('PASS - viewer initialized; mesh parts:',count,'UI tabs, inspector OK');
}finally{await browser.close()}
