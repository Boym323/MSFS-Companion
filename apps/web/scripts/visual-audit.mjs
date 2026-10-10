/**
 * Offline UI evidence. This is a layout/readability/screenshot CI, NOT proof
 * of a live MSFS connection or pixel-perfect aircraft hardware fidelity.
 * Use a separate browser context for each real-world tablet width.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {A320_TABS} from '../src/a320/a320Tabs.ts';

const base=process.env.VISUAL_BASE_URL??'http://127.0.0.1:4173';
const out=new URL('../visual-artifacts/',import.meta.url);
const targets=[
 {name:'desktop',width:1440,height:900},
 {name:'ipad-landscape',width:1024,height:768},
 {name:'ipad-portrait',width:768,height:1024},
 {name:'phone',width:390,height:844},
 {name:'small-phone',width:320,height:700}
];
const manifest=[];
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const device of targets){
  const context=await browser.newContext({
   viewport:{width:device.width,height:device.height},
   deviceScaleFactor:1,reducedMotion:'reduce'
  });
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  for(const tab of A320_TABS){
   await page.goto(base+'/a320?panel='+tab.id,{waitUntil:'domcontentloaded'});
   await page.locator('.a320-instrument-tabs').waitFor({state:'visible'});
   await page.locator('.a320-instrument-stage > section').waitFor({state:'visible'});
   // UI-REF-11: the active tab must be visible inside its scrolling row.
   await page.waitForFunction(()=>{
    const nav=document.querySelector('.a320-instrument-tabs');
    const link=nav?.querySelector('a[aria-current="page"]');
    if(!nav||!link)return false;
    const a=link.getBoundingClientRect(),n=nav.getBoundingClientRect();
    return a.left>=n.left-3&&a.right<=n.right+3;
   },null,{timeout:5000});
   const active=await page.locator('.a320-instrument-tabs a[aria-current="page"]').allTextContents();
   assert.deepEqual(active.map(s=>s.trim()),[tab.label],
    device.name+'/'+tab.id+': active page must be unique');
   assert.equal(await page.locator('.a320-instrument-stage > section').count(),1,
    device.name+'/'+tab.id+': exactly one instrument is mounted');
   if(tab.id!=='diagnostics'){
    assert.equal(await page.locator('.a320-diagnostic-content').count(),0,
     device.name+'/'+tab.id+': evidence controls must stay outside flight deck');
   }
   const geometry=await page.evaluate(()=>{
    const element=document.documentElement;
    const stage=document.querySelector('.a320-instrument-stage');
    return {
     viewport:innerWidth,body:element.scrollWidth,
     stageWidth:stage?.getBoundingClientRect().width??0,
     stageTop:stage?.getBoundingClientRect().top??0,
     activeTabHeight:document.querySelector('.a320-instrument-tabs a[aria-current="page"]')?.getBoundingClientRect().height??0,
     primaryHeight:document.querySelector('.cockpit-primary-nav a.selected')?.getBoundingClientRect().height??0,
     stagePresent:!!stage
    };
   });
   assert.ok(geometry.body<=geometry.viewport+2,
    device.name+'/'+tab.id+': viewport overflow '+JSON.stringify(geometry));
   assert.ok(geometry.stagePresent&&geometry.stageWidth>0);
   assert.ok(geometry.activeTabHeight>=43&&geometry.primaryHeight>=43,
    device.name+'/'+tab.id+': navigation touch targets below 44 px '+JSON.stringify(geometry));
   if(device.width<=768){
    assert.ok(geometry.stageTop<device.height-80,
     device.name+'/'+tab.id+': primary instrument starts below the first viewport '+JSON.stringify(geometry));
    assert.equal(await page.locator('.cockpit-mobile-tools').isVisible(),true,
     device.name+': compact tools selector should be visible');
    assert.equal(await page.locator('.cockpit-secondary-nav').isVisible(),false,
     device.name+': redundant second nav row must be hidden');
   }
   if(tab.id==='fcu'){
    const fit=page.getByRole('button',{name:'Přizpůsobit'});
    const actual=page.getByRole('button',{name:'1:1',exact:true});
    const fullscreen=page.getByRole('button',{name:'Celá obrazovka'});
    if(device.width>=640){
     assert.equal(await fit.getAttribute('aria-pressed'),'true',
      device.name+': default iPad/desktop mode should fit the FCU');
    }else{
     assert.equal(await actual.getAttribute('aria-pressed'),'true',
      device.name+': phones keep usable 1:1 controls by default');
    }
    await fit.click();
    await page.waitForFunction(()=>{
     const s=document.querySelector('.a320-hw-scroll');
     return s&&s.scrollWidth<=s.clientWidth+3;
    },null,{timeout:5000});
    await actual.click();
    assert.equal(await actual.getAttribute('aria-pressed'),'true');
    await fullscreen.click();
    assert.equal(await page.locator('.a320-hw-viewer.is-fullscreen').count(),1);
    assert.equal(await fit.getAttribute('aria-pressed'),'true',
     device.name+': fullscreen opens with the complete instrument fitted');
    if(device.name==='ipad-landscape'||device.name==='phone'){
     const zoomFile=device.name+'--a320-fcu-fullscreen.png';
     await page.screenshot({path:new URL(zoomFile,out).pathname,animations:'disabled'});
     manifest.push({file:zoomFile,...device,panel:'fcu-fullscreen',
      note:'offline fullscreen control audit'});
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.a320-hw-viewer.is-fullscreen').count(),0,
     device.name+': Escape should dismiss the overlay');
    if(device.width>=640)await fit.click();
   }
   const file=device.name+'--a320-'+tab.id+'.png';
   await page.screenshot({path:new URL(file,out).pathname,
    fullPage:true,animations:'disabled'});
   manifest.push({file,...device,panel:tab.id,geometry,
    note:'offline visual baseline (not an MSFS in-game comparison)'});
  }
  // Workspace should never mount the whole Airbus dashboard into a half-column.
  await page.goto(base+'/workspace',{waitUntil:'domcontentloaded'});
  const toggle=page.getByLabel('Airbus A320 readback');
  await toggle.check();
  assert.equal(await page.locator('.a320-compact').count(),1,
   device.name+': expected compact Airbus Workspace tile');
  assert.equal(await page.locator('.a320-ui-shell').count(),0,
   device.name+': large FCU must never mount in Workspace');
  const workspaceFile=device.name+'--workspace.png';
  await page.screenshot({path:new URL(workspaceFile,out).pathname,
   fullPage:true,animations:'disabled'});
  manifest.push({file:workspaceFile,...device,panel:'workspace',
   note:'compact Airbus workspace; offline'});
  assert.deepEqual(runtimeErrors,[],device.name+': unhandled browser errors');
  await context.close();
 }
 // Navigation must work using real browser history on iPad dimensions.
 const context=await browser.newContext({viewport:{width:768,height:1024}});
 const page=await context.newPage();
 await page.goto(base+'/a320?panel=fcu',{waitUntil:'domcontentloaded'});
 await page.locator('.a320-instrument-tabs a[href*="panel=ecam"]').click();
 assert.equal(new URL(page.url()).searchParams.get('panel'),'ecam');
 await page.goBack();
 assert.equal(new URL(page.url()).searchParams.get('panel'),'fcu');
 assert.equal(await page.locator('.a320-instrument-tabs a[aria-current="page"]').innerText(),'FCU');
 await context.close();
 await writeFile(new URL('manifest.json',out),JSON.stringify({
  generatedAt:new Date().toISOString(),base,kind:'offline screenshot and layout regression',
  entries:manifest},null,2));
 console.log('UI visual audit: PASS, '+manifest.length+' screenshots / '+targets.length+' viewports');
}finally{
 await browser.close();
}
