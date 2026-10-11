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
   assert.equal(await page.locator('.telemetry-offline').count(),0,
    device.name+'/'+tab.id+': A320 must not repeat the global offline banner');
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
   assert.ok(geometry.stageTop>=0,device.name+'/'+tab.id+': instrument stage clipped above viewport');
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
  const toggle=page.getByRole('checkbox',{name:'Airbus A320 readback'});
  await toggle.check();
  assert.equal(await page.locator('.a320-compact').count(),1,
   device.name+': expected compact Airbus Workspace tile');
  assert.equal(await page.locator('.a320-ui-shell').count(),0,
   device.name+': large FCU must never mount in Workspace');
  const lock=page.locator('.cockpit-workspace-lock input[type="checkbox"]');
  await lock.check();
  assert.equal(await toggle.isDisabled(),true,
    device.name+': locked tablet layout must disable instrument selection');
  if(device.name==='ipad-portrait'){
    const lockedFile=device.name+'--workspace-locked.png';
    await page.screenshot({path:new URL(lockedFile,out).pathname,
      fullPage:true,animations:'disabled'});
    manifest.push({file:lockedFile,...device,panel:'workspace-locked',
      note:'iPad layout lock must protect instrument choices'});
  }
  await lock.uncheck();
  assert.equal(await toggle.isDisabled(),false);
  const workspaceFile=device.name+'--workspace.png';
  await page.screenshot({path:new URL(workspaceFile,out).pathname,
   fullPage:true,animations:'disabled'});
  manifest.push({file:workspaceFile,...device,panel:'workspace',
   note:'compact Airbus workspace; offline'});
  for(const screen of corePages){
   await page.goto(base+screen.route,{waitUntil:'domcontentloaded'});
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
    assert.equal(await main.locator('.telemetry-offline').count(),0,
      device.name+': overview must not duplicate offline status');
    assert.equal(await main.evaluate(el=>{
      const a=el.querySelector('.overview-live'),b=el.querySelector('.overview-maintenance');
      return !!a&&!!b&&!!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING);
    }),true,device.name+': telemetry must come before maintenance');
    if(device.name==='desktop'||device.name==='phone'){
      await maintenance.locator('summary').click();
      assert.equal(await maintenance.evaluate(el=>el.hasAttribute('open')),true);
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
