import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = spawn('bun', ['tools/preview-ui.js'], { env: {...process.env, UI_PORT:'4318'}, stdio:'ignore' });
const base='http://127.0.0.1:4318';
let browser;
try {
  for(let i=0;i<40;i++){try{if((await fetch(base+'/rjuhsd/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/school-info')return route.fulfill({json:{events:[{date:'2026-09-07',title:'Labor Day — No school'}]}});
    if(url.origin!==base)return route.abort();
    return route.continue();
  });
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(7000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-09-09T19:00:00Z')});
  await page.goto(base+'/rjuhsd/');
  await page.locator('#school-select option').first().waitFor({state:'attached'});
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    for(const school of ['woodcreek','roseville','granitebay','antelope','westpark','oakmont']){
      await page.selectOption('#school-select',school);
      await page.waitForFunction(s=>document.body.dataset.school===s,school);
      await page.locator('#change-lunch').click();
      await page.locator('[data-choose-lunch="2"]').click();
      assert((await page.locator('#timeline').innerText()).includes('Period 1'));
      assert(!(await page.locator('body').innerText()).includes('NaN'));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),school+' overflows '+width);
      if(school==='roseville')assert((await page.locator('#snapshot-first').innerText()).includes('9:25'));
      if(['westpark','antelope'].includes(school))assert((await page.locator('#timeline').innerText()).includes('1:28 PM'));
    }
  }
  await page.reload();
  assert.equal(await page.locator('#school-select').inputValue(),'oakmont');
  assert.equal((await page.locator('#header-lunch').innerText()).toLowerCase(),'combined lunch');
  await page.clock.setSystemTime(new Date('2026-09-07T19:00:00Z'));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#current-period').textContent.includes('Labor Day'));
  assert.equal(await page.locator('#countdown').innerText(),'—');
  await page.clock.setSystemTime(new Date('2026-09-12T19:00:00Z'));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#current-period').textContent==='No school');
  await page.clock.setSystemTime(new Date('2026-09-09T19:00:00Z'));
  await page.reload();
  await page.selectOption('#school-select','woodcreek');
  await mkdir('artifacts/ui-review',{recursive:true});
  await page.screenshot({path:'artifacts/ui-review/rjuhsd-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'artifacts/ui-review/rjuhsd-desktop.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: six schools, both screen sizes, lunch selection, persistence, Wednesday times, holiday and weekend countdowns.');
} finally { await browser?.close();server.kill(); }
