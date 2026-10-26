/** Real J/button input, natural movement, no teleporting or resetting attack cooldowns. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const state=()=>page.evaluate(async()=>{
  const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('Canvas').getComponent('AdventureGame');
  return {mode:g.model.mode,x:g.model.player.x,enemy:g.model.enemies[0],attackTime:g.model.player.attackTime,
   frame:g.heroVisual.getComponent(cc.Sprite).spriteFrame.name,status:g.labels.combat.string,touch:g.touchAttack,
   highlighted:g.actionHighlights.attack.active,events:window.attackEvents,frames:[...window.attackFrames],left:g.heroVisual.scale.x<0};
 });
 try{
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:7456');await page.waitForTimeout(3500);
  await page.waitForFunction(async()=>{try{const cc=await System.import('cc');return cc.director.getScene()?.getChildByName('Canvas')?.getComponent('AdventureGame')?.ready;}catch{return false;}},{},{timeout:30000});
  await page.mouse.click(640,468);
  await page.evaluate(async()=>{
   const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('Canvas').getComponent('AdventureGame');
   window.attackEvents=[];window.attackFrames=new Set();const emit=g.model.emit.bind(g.model);
   g.model.emit=(type,data)=>{if(type==='attack')window.attackEvents.push(data);return emit(type,data);};
   cc.director.on(cc.Director.EVENT_AFTER_UPDATE,()=>{const frame=g.heroVisual.getComponent(cc.Sprite).spriteFrame.name;if(frame.startsWith('hero-attack'))window.attackFrames.add(frame);});
  });
  await page.keyboard.down('j');await page.waitForTimeout(90);await page.screenshot({path:'docs/试玩-攻击动作.png'});await page.waitForTimeout(650);
  let s=await state();assert.ok(s.events.length>=2,'holding J must repeat attacks');assert.equal(s.frames.length,4,'all four character poses must actually render');assert.match(s.status,/未命中/);assert.equal(s.events[0].hits,0);
  await page.keyboard.up('j');await page.waitForTimeout(750);s=await state();assert.equal(s.frame,'hero-idle');assert.equal(s.highlighted,false);
  const before=s.events.length;await page.mouse.move(939,607);await page.mouse.down();await page.waitForTimeout(740);s=await state();assert.equal(s.touch,true);assert.ok(s.events.length>=before+2,'holding the attack button must repeat attacks');
  await page.mouse.up();await page.waitForTimeout(650);s=await state();assert.equal(s.touch,false);const released=s.events.length;await page.waitForTimeout(400);assert.equal((await state()).events.length,released,'releasing the button must stop attacks');
  await page.keyboard.down('d');let approached=false;
  for(let i=0;i<70;i++){await page.waitForTimeout(60);s=await state();if(s.enemy.x-s.x<110){approached=true;break;}}
  await page.keyboard.up('d');assert.ok(approached,'walk naturally into melee range');
  await page.keyboard.down('j');await page.waitForTimeout(60);s=await state();assert.ok(s.enemy.hp<48,'J must damage a nearby enemy');assert.match(s.status,/命中 1/);await page.screenshot({path:'docs/试玩-攻击命中.png'});
  await page.keyboard.up('j');await page.waitForTimeout(400);await page.keyboard.down('a');await page.waitForTimeout(80);await page.keyboard.up('a');await page.keyboard.down('j');await page.waitForTimeout(90);s=await state();assert.equal(s.left,true);await page.keyboard.up('j');
  await page.keyboard.press('Escape');s=await state();assert.equal(s.mode,'paused');const paused=s.events.length;await page.keyboard.press('j');await page.waitForTimeout(400);assert.equal((await state()).events.length,paused);
  assert.deepEqual(errors,[]);
  const result={engine:'3.8.8',passed:true,renderedFrames:s.frames,keyboardRepeat:true,touchRepeat:true,releaseStops:true,naturalWalkMelee:true,hitAndMissFeedback:true,pauseBlocksAttack:true,errors};
  fs.writeFileSync('docs/攻击验证结果.json',JSON.stringify(result,null,2));console.log('PASS',JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
