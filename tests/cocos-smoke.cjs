/** Browser integration against the actual Cocos build. Test positioning is accelerated. */
const {chromium}=require('playwright'), assert=require('node:assert/strict'), fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const game=async(fn,arg)=>page.evaluate(async({fn,arg})=>{const cc=await System.import('cc');const g=cc.director.getScene().getChildByName('Canvas').getComponent('AdventureGame');return (new Function('g','cc','arg',`return (${fn})(g,cc,arg)`))(g,cc,arg);},{fn:fn.toString(),arg});
 try {
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:7456');
 await page.waitForTimeout(3500);
 await page.waitForFunction(async()=>{try{const cc=await System.import('cc');return !!cc.director.getScene()?.getChildByName('Canvas')?.getComponent('AdventureGame')?.ready;}catch{return false;}},{},{timeout:30000});
 assert.equal(await game((g,cc)=>cc.VERSION),'3.8.8');
 await page.screenshot({path:'docs/试玩-标题.png'});
 // The initial button must work through the real Cocos touch dispatcher.
 await page.mouse.click(640,468); await page.waitForTimeout(150); assert.equal(await game(g=>g.model.mode),'play');
 const before=await game(g=>g.model.player.x); await page.keyboard.down('d'); await page.waitForTimeout(550); await page.keyboard.up('d');
 assert.ok(await game(g=>g.model.player.x)>before+100);
 await page.keyboard.press('e'); await page.waitForTimeout(100); assert.ok(await game(g=>!!g.overlay));
 await page.keyboard.press('Enter'); assert.equal(await game(g=>g.model.quest),1);
 await page.keyboard.press('Space'); await page.waitForTimeout(120); await page.keyboard.press('Space');
 assert.equal(await game(g=>g.model.player.jumps),2); await page.waitForTimeout(1100);
 await page.screenshot({path:'docs/试玩-村庄.png'});
 await page.keyboard.press('b'); assert.ok(await game(g=>!!g.overlay)); await page.keyboard.press('Escape'); assert.equal(await game(g=>g.model.mode),'play');
 // Validate actual keyboard attacks against every enemy, accelerating travel only.
 for(let i=0;i<5;i++) {
   for(let hit=0;hit<4;hit++) {
     const dead=await game((g,cc,id)=>{const e=g.model.enemies[id];if(e.dead)return true;Object.assign(g.model.player,{x:e.x-78,y:e.y,vy:0,face:1,attackCd:0,invulnerable:10});return false;},i);
     if(dead)break; await page.keyboard.press('j'); await page.waitForTimeout(120);
   }
   assert.equal(await game((g,cc,id)=>g.model.enemies[id].dead,i),true);
 }
 assert.equal(await game(g=>g.model.quest),2); assert.equal(await game(g=>g.model.leaves),5);
 await game(g=>{g.model.player.x=2110;}); await page.keyboard.press('e'); assert.equal(await game(g=>g.model.player.x),475);
 await page.keyboard.press('e'); await page.keyboard.press('Enter'); assert.equal(await game(g=>g.model.quest),3);
 await game(g=>{g.model.player.x=570;}); await page.keyboard.press('e'); assert.equal(await game(g=>g.model.player.x),3910);
 await game(g=>{g.model.player.x=4300;g.model.player.invulnerable=20;g.model.camera=3830;});
 await page.waitForTimeout(1700); await page.screenshot({path:'docs/试玩-首领.png'});
 for(let hit=0;hit<20;hit++) {
   if(await game(g=>g.model.bossDead))break;
   await game(g=>{const e=g.model.enemies[10];Object.assign(g.model.player,{x:e.x-105,y:144,vy:0,face:1,attackCd:0,invulnerable:10});});
   await page.keyboard.press('j'); await page.keyboard.press('k'); await page.waitForTimeout(120);
 }
 assert.equal(await game(g=>g.model.bossDead),true); assert.equal(await game(g=>g.model.quest),4);
 await game(g=>{g.model.player.x=4970;}); await page.keyboard.press('e'); await page.waitForTimeout(200);
 assert.equal(await game(g=>g.model.mode),'victory'); await page.screenshot({path:'docs/试玩-通关.png'});
 await page.reload(); await page.waitForTimeout(2500); await page.keyboard.press('Enter'); assert.equal(await game(g=>g.model.quest),5);
 const state=await game(g=>({quest:g.model.quest,level:g.model.player.level,kills:g.model.kills,bossDead:g.model.bossDead}));
 assert.deepEqual(errors,[]); console.log('PASS Cocos 3.8.8 input, UI, quest, combat, boss, victory, reload',JSON.stringify(state));
 fs.writeFileSync('docs/浏览器验证结果.json',JSON.stringify({engine:'3.8.8',passed:true,errors,state,testTravelAccelerated:true},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
