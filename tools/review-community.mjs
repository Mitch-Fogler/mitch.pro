import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
await context.route('**/api/**',async route=>{
  const path = new URL(route.request().url()).pathname;
  const payload = path==='/api/friends/list' ? {friends:[{handle:'alex',displayName:'Alex',online:true,playing:'Chess'},{handle:'sam',displayName:'Sam',online:false}]} :
    path==='/api/guest-session' ? {authenticated:false,expiresAt:Date.now()+1100,serverNow:Date.now()} :
    path==='/api/me' ? {email:'test@example.test',displayName:'Test',isOwner:false} : {members:[],friends:[],items:[],success:false};
  await route.fulfill({json:payload});
});
const page = await context.newPage();
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:4317/',{waitUntil:'domcontentloaded'});
await page.addStyleTag({url:'/community-refresh.css'});
await page.getByText('Playing Chess',{exact:true}).waitFor();
assert.equal(await page.locator('.home-friends').count(),1);
assert.equal(await page.locator('.home-schedule-button[href*="rjuhsd"]').count(),1);
await page.screenshot({path:'artifacts/community-chromebook.png',fullPage:false});
console.log('Chromebook layout',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,friends:document.querySelector('.home-friends').getBoundingClientRect().toJSON()})));
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'artifacts/community-mobile.png',fullPage:false});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile homepage should not overflow horizontally');
await page.addScriptTag({url:'/guest-preview.js'});
await page.locator('.guest-signup[open]').waitFor();
await page.keyboard.press('Escape');
assert.ok(await page.locator('.guest-signup').evaluate(dialog=>dialog.open));
await page.getByRole('link',{name:'Create a free account',exact:true}).click();
await page.waitForURL('**/enroll/?mode=signup');
assert.equal(await page.locator('#pane-invite').evaluate(el=>el.classList.contains('active')),true);
await page.addStyleTag({url:'/community-refresh.css'});
await page.screenshot({path:'artifacts/community-signup.png',fullPage:false});
console.log('Page errors',errors);
await browser.close();
console.log('Friends activity, mobile sizing, guest dialog and signup flow passed.');
