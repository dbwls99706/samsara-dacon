import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
const OUT='scripts/ui-out';
if (existsSync(OUT)) rmSync(OUT,{recursive:true,force:true});
mkdirSync(OUT,{recursive:true});
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport:{width:412,height:915}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
// 신규 플레이어처럼: tutorial 안 봄 → 하지만 바로 플레이로 (skip)
await ctx.addInitScript(()=>{try{localStorage.setItem('samsara.tutorial.done','1');}catch{}});
const p = await ctx.newPage();
await p.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
await p.locator('button:visible').filter({hasText:/시작|PLAY|START/}).first().click({timeout:4000}).catch(()=>{});
// 카운트다운 끝나고 플레이 시작 (~2.2s) 후 바로 — "초반에 스킬 뭔지" 시점
await p.waitForTimeout(2600);
await p.screenshot({path:`${OUT}/play-early.png`});  // 막 시작한 시점
// 몇 초 더 플레이
const tapX=Math.round(412*0.7), tapY=Math.round(915*0.4);
for(let i=0;i<35;i++){ await p.touchscreen.tap(tapX,tapY).catch(()=>{}); await p.waitForTimeout(110); }
await p.screenshot({path:`${OUT}/play-mid.png`});
await b.close(); console.log('ok');
