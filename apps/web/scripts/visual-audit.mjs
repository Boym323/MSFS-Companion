/**
 * Offline UI evidence. This is a layout/readability/screenshot CI, NOT proof
 * of a live MSFS connection or pixel-perfect aircraft hardware fidelity.
 * Use a separate browser context for each real-world tablet width.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.VISUAL_BASE_URL??'http://127.0.0.1:4173';
const out=new URL('../visual-artifacts/',import.meta.url);
const targets=[
 {name:'desktop',width:1440,height:900},
 {name:'compact-desktop',width:1280,height:800},
 {name:'ipad-landscape',width:1024,height:768},
 {name:'ipad-portrait',width:768,height:1024},
 {name:'phone',width:390,height:844},
 {name:'phone-375',width:375,height:812},
 {name:'small-phone',width:320,height:700}
];
const manifest=[];
const corePages=[
 {route:'/admin',name:'overview'},
 {route:'/pfd',name:'pfd'},
 {route:'/map',name:'map'},
 {route:'/radio-assistant',name:'radio-assistant'},
 {route:'/vatsim',name:'vatsim'},
 {route:'/flights',name:'flights'},
 {route:'/flight-plan',name:'flight-plan'},
 {route:'/briefing',name:'airport-briefing'},
 {route:'/controls',name:'controls'},
 {route:'/health',name:'health'},
 {route:'/pilot',name:'pilot-assistant'}
];
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
  // Retired Asobo route must not mount the legacy FCU or send commands.
  await page.goto(base+'/a320',{waitUntil:'domcontentloaded'});
  assert.equal(await page.getByText('Původní Asobo A320 V1 a WASM byly vyřazeny').count(),1);
  assert.equal(await page.locator('.a320-instrument-stage').count(),0);
  // Workspace remains usable and its iPad lock prevents accidental edits.
  await page.goto(base+'/workspace',{waitUntil:'domcontentloaded'});
  await page.locator('.page-loading').waitFor({state:'hidden',timeout:15000});
  const lock=page.locator('.cockpit-workspace-lock input[type="checkbox"]');
  await lock.check();
  assert.equal(await page.getByRole('checkbox',{name:'PFD',exact:true}).isDisabled(),true);
  if(device.name==='ipad-portrait'){
    const lockedFile=device.name+'--workspace-locked.png';
    await page.screenshot({path:new URL(lockedFile,out).pathname,fullPage:true,animations:'disabled'});
    manifest.push({file:lockedFile,...device,panel:'workspace-locked',note:'iPad workspace lock regression'});
  }
  await lock.uncheck();
  const workspaceFile=device.name+'--workspace.png';
  await page.screenshot({path:new URL(workspaceFile,out).pathname,fullPage:true,animations:'disabled'});
  manifest.push({file:workspaceFile,...device,panel:'workspace',note:'PFD/map workspace; offline'});
  for(const screen of corePages){
   await page.goto(base+screen.route,{waitUntil:'domcontentloaded'});
   await page.locator('.page-loading').waitFor({state:'hidden',timeout:15000});
   const selected=page.locator('.cockpit-primary-nav a[aria-current="location"]');
   await selected.waitFor({state:'visible'});
   await page.waitForFunction(()=>{
    const nav=document.querySelector('.cockpit-primary-nav');
    const link=nav?.querySelector('a[aria-current="location"]');
    if(!nav||!link)return false;
    const a=link.getBoundingClientRect(),n=nav.getBoundingClientRect();
    return a.left>=n.left-3&&a.right<=n.right+3;
   },null,{timeout:5000});
   const geometry=await page.evaluate(()=>{
    const nav=document.querySelector('.cockpit-primary-nav a[aria-current="location"]');
    return {viewport:innerWidth,body:document.documentElement.scrollWidth,
      navHeight:nav?.getBoundingClientRect().height??0};
   });
   assert.ok(geometry.body<=geometry.viewport+2,
    device.name+'/'+screen.name+': horizontal document overflow '+JSON.stringify(geometry));
   assert.ok(geometry.navHeight>=43,
    device.name+'/'+screen.name+': main navigation touch target below 44 px');
   const file=device.name+'--'+screen.name+'.png';
   await page.screenshot({path:new URL(file,out).pathname,
    fullPage:true,animations:'disabled'});
   manifest.push({file,...device,panel:screen.name,geometry,note:'offline core-page UX audit'});
   if(screen.name==='overview'){
    const main=page.locator('.overview-screen');
    assert.equal(await main.locator('.overview-live').count(),1,
      device.name+': primary telemetry section must exist');
    const maintenance=main.locator('.overview-maintenance');
    assert.equal(await maintenance.getAttribute('open'),null,
      device.name+': Windows maintenance starts collapsed');
    assert.equal(await maintenance.locator('.update-panel').count(),0,
      device.name+': closed maintenance must not poll the Windows updater');
    assert.equal(await main.locator('.telemetry-offline').count(),0,
      device.name+': overview must not duplicate offline status');
    assert.equal(await main.evaluate(el=>{
      const a=el.querySelector('.overview-live'),b=el.querySelector('.overview-maintenance');
      return !!a&&!!b&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
    }),true,device.name+': telemetry must come before maintenance');
    if(device.name==='desktop'||device.name==='phone'){
      await maintenance.locator('summary').click();
      assert.equal(await maintenance.evaluate(el=>el.hasAttribute('open')),true);
      await maintenance.locator('.update-panel').waitFor({state:'visible',timeout:15000});
      assert.equal(await maintenance.locator('.update-panel').isVisible(),true);
      const expandedWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(expandedWidth<=device.width+2,device.name+': maintenance disclosure overflow');
      const expandedFile=device.name+'--overview-maintenance-expanded.png';
      await page.screenshot({path:new URL(expandedFile,out).pathname,fullPage:true,animations:'disabled'});
      manifest.push({file:expandedFile,...device,panel:'overview-maintenance-expanded',
        note:'offline maintenance disclosure regression'});
    }
   }
   if(screen.name==='flights'){
    const history=page.locator('.flight-history');
    const backup=history.locator('.flight-history-backup');
    assert.equal(await backup.getAttribute('open'),null,
      device.name+': optional archive operations start collapsed');
    assert.equal(await history.evaluate(el=>{
      const a=el.querySelector('.flight-history-layout'),b=el.querySelector('.flight-history-backup');
      return !!a&&!!b&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
    }),true,device.name+': flights before backup form');
    if(device.name==='desktop'||device.name==='phone'){
      await backup.locator('summary').click();
      assert.equal(await backup.locator('.flight-history-backup-actions').isVisible(),true);
      const expandedWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(expandedWidth<=device.width+2,device.name+': archive form overflow');
      const expandedFile=device.name+'--flights-backup-expanded.png';
      await page.screenshot({path:new URL(expandedFile,out).pathname,fullPage:true,animations:'disabled'});
      manifest.push({file:expandedFile,...device,panel:'flights-backup-expanded',
        note:'offline archive operations regression'});
    }
   }
   if(screen.name==='flights' && (device.name==='desktop'||device.name==='phone'||device.name==='ipad-portrait')){
    // Reproducible, explicitly MOCK flight: checks layout with populated charts/map.
    const summary={id:'visual-flight',mode:'mock',aircraft:'Cessna 172',
      startedAtUtc:'2026-10-10T09:00:00Z',endedAtUtc:'2026-10-10T09:05:00Z',
      lastAtUtc:'2026-10-10T09:05:00Z',samples:3,
      distanceMeters:12500,maxAirspeedKnots:110,maxAltitudeFeet:4000,active:false};
    const samples=[
      [49.20,17.60,85,2900,'2026-10-10T09:00:00Z'],
      [49.24,17.66,105,3450,'2026-10-10T09:02:30Z'],
      [49.29,17.71,110,4000,'2026-10-10T09:05:00Z']
    ].map(([latitude,longitude,airspeedKnots,altitudeFeet,timestampUtc])=>({
      timestampUtc,aircraft:summary.aircraft,latitude,longitude,airspeedKnots,
      altitudeFeet,verticalSpeedFeetPerMinute:250,headingDegrees:30,
      pitchDegrees:2,bankDegrees:0,onGround:false,altitudeAglFeet:1800
    }));
    await page.route('**/api/flights',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify([summary])
    }));
    await page.route('**/api/flights/*',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify({summary,samples})
    }));
    await page.goto(base+'/flights',{waitUntil:'domcontentloaded'});
   await page.locator('.page-loading').waitFor({state:'hidden',timeout:15000});
    await page.locator('.flight-history-player').waitFor({state:'visible'});
    assert.equal(await page.locator('.flight-history-summary').count(),1);
    assert.equal(await page.locator('.flight-history-tools').getAttribute('open'),null);
    const related=await page.evaluate(()=>{
      const player=document.querySelector('.flight-history-player');
      const values=document.querySelector('.flight-history-values');
      const map=document.querySelector('.flight-route-map');
      const archive=document.querySelector('.flight-history-backup');
      const chart=document.querySelector('.flight-replay-charts');
      if(!player||!values||!map||!archive||!chart)return false;
      const before=(a,b)=>!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
      return before(player,values)&&before(values,chart)&&before(chart,map)&&before(map,archive);
    });
    assert.ok(related,device.name+': player, values, chart, map and backup must follow flight workflow order');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),
      device.name+': populated flight workflow overflow');
    const recordFile=device.name+'--flights-recorded-mock.png';
    await page.screenshot({path:new URL(recordFile,out).pathname,
      fullPage:true,animations:'disabled'});
    manifest.push({file:recordFile,...device,panel:'flights-recorded-mock',
      note:'deterministic mocked flight layout; not real MSFS data'});
    await page.unroute('**/api/flights');
    await page.unroute('**/api/flights/*');
   }
   if(screen.name==='flight-plan'){
    assert.equal(await page.locator('.flight-planner-import').count(),1);
    assert.equal(await page.locator('.flight-planner-next a[href="/map"]').isVisible(),true);
    assert.equal(await page.locator('.flight-planner-next a[href="/briefing"]').isVisible(),true);
   }
   if(screen.name==='airport-briefing'){
    const picker=page.locator('.airport-briefing-selection');
    assert.equal(await picker.locator('input[placeholder="LKPR"]').count(),1,
      device.name+': ICAO and airport search must share the selection area');
    assert.equal(await page.locator('.airport-briefing-conditions').count(),1);
   }
   if(screen.name==='radio-assistant'){
    assert.equal(await page.locator('.smart-radio-vatsim').count(),1,
      device.name+': online ATC must be separate from static airport frequencies');
   }
   if(screen.name==='map'){
    const surface=page.getByRole('button',{name:'Detail pojíždění'});
    assert.equal(await surface.isDisabled(),true,
      device.name+': airport surface mode must never show synthetic offline position');
    const canvas=page.locator('.moving-map-canvas');
    assert.equal(await canvas.locator('.moving-map-zoom').count(),1,
     device.name+': zoom buttons must live inside map canvas');
    const layers=page.locator('.moving-map-layers');
    assert.equal(await layers.getAttribute('open'),null,
     device.name+': advanced layers should start collapsed');
    assert.equal(await page.locator('.moving-map-clear').isDisabled(),true,
     device.name+': no track to clear while MSFS is offline');
    const mapOrder=await page.evaluate(()=>{
     const map=document.querySelector('.moving-map-canvas');
     const panel=document.querySelector('.moving-map-layers');
     return !!map&&!!panel&&map.compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING;
    });
    assert.ok(mapOrder,device.name+': map must precede its settings');
    const zoomIn=canvas.getByRole('button',{name:'Přiblížit mapu'});
    const zoomOut=canvas.getByRole('button',{name:'Oddálit mapu'});
    assert.match(await canvas.locator('.moving-map-zoom output').innerText(),/Zoom 11/);
    await zoomIn.click();
    assert.match(await canvas.locator('.moving-map-zoom output').innerText(),/Zoom 12/);
    await zoomOut.click();
    assert.match(await canvas.locator('.moving-map-zoom output').innerText(),/Zoom 11/);
    await layers.locator('summary').click();
    assert.equal(await layers.evaluate(el=>el.hasAttribute('open')),true);
    assert.equal(await layers.getByText('Základní podklad').isVisible(),true);
    const expandedWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(expandedWidth<=device.width+2,device.name+': expanded map layers overflow');
    if(device.name==='desktop'||device.name==='phone'){
     const expandedFile=device.name+'--map-layers-expanded.png';
     await page.screenshot({path:new URL(expandedFile,out).pathname,
      fullPage:true,animations:'disabled'});
     manifest.push({file:expandedFile,...device,panel:'map-layers-expanded',
      note:'offline settings disclosure and zoom interaction audit'});
    }
   }
   if(screen.name==='controls'){
    const disclosure=page.locator('.control-deck-disclosure');
    assert.equal(await disclosure.getAttribute('open'),null,
     device.name+': offline control deck should be collapsed');
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.evaluate(el=>el.hasAttribute('open')),true);
    assert.equal(await page.locator('.control-tile button').first().isDisabled(),true,
     device.name+': opening offline deck must never enable a command');
    const expandedWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert.ok(expandedWidth<=device.width+2,device.name+': expanded controls overflow');
    const expandedFile=device.name+'--controls-expanded.png';
    await page.screenshot({path:new URL(expandedFile,out).pathname,
     fullPage:true,animations:'disabled'});
    manifest.push({file:expandedFile,...device,panel:'controls-expanded',
     note:'offline control deck expanded; buttons must remain disabled'});
   }
  }
  assert.deepEqual(runtimeErrors,[],device.name+': unhandled browser errors');
  await context.close();
 }
 await writeFile(new URL('manifest.json',out),JSON.stringify({
  generatedAt:new Date().toISOString(),base,kind:'offline screenshot and layout regression',
  entries:manifest},null,2));
 console.log('UI visual audit: PASS, '+manifest.length+' screenshots / '+targets.length+' viewports');
}finally{
 await browser.close();
}
