/** Validate native clipping, scaling, modal coverage and pointer coordinates across window sizes. */
const {chromium}=require('playwright'),{PNG}=require('pngjs'),assert=require('node:assert/strict'),fs=require('node:fs');
const sizes=[{name:'embedded-wide',width:1466,height:642},{name:'standard',width:1280,height:720},
 {name:'four-three',width:1024,height:768},{name:'phone-landscape',width:844,height:390},{name:'portrait',width:390,height:844}];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[],errors=[],hostWarnings=[];
 async function data(page){return page.evaluate(async()=>{
  const cc=await System.import('cc'),g=cc.director.getScene().getChildByName('Canvas').getComponent('AdventureGame');
  const canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect(),v=cc.view.getViewportRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;
  return {engine:cc.VERSION,rect:{x:r.x+v.x/sx,y:r.y+(canvas.height-v.y-v.height)/sy,w:v.width/sx,h:v.height/sy},
   mask:!!g.root.getComponent(cc.Mask),size:g.root.getComponent(cc.UITransform).contentSize,mode:g.model.mode,attackTime:g.model.player.attackTime,touch:g.touchAttack,
   modal:g.overlay?g.overlay.getComponentsInChildren(cc.Label).map(l=>l.string).join('|'):''};
 });}
 async function click(page,r,x,y){await page.mouse.click(r.x+x/1280*r.w,r.y+y/720*r.h);}
 function checkPixels(buffer,viewport,r){
  const p=PNG.sync.read(buffer),sx=p.width/viewport.width,sy=p.height/viewport.height;
  const points=[];
  if(r.x>4)for(const f of [0.15,0.5,0.85])points.push([r.x/2,viewport.height*f]);
  if(viewport.width-r.x-r.w>4)for(const f of [0.15,0.5,0.85])points.push([(r.x+r.w+viewport.width)/2,viewport.height*f]);
  if(r.y>4)for(const f of [0.15,0.5,0.85])points.push([viewport.width*f,r.y/2]);
  if(viewport.height-r.y-r.h>4)for(const f of [0.15,0.5,0.85])points.push([viewport.width*f,(r.y+r.h+viewport.height)/2]);
  for(const [x,y]of points){const i=(Math.floor(y*sy)*p.width+Math.floor(x*sx))*4;const rgb=[...p.data.subarray(i,i+3)];
   assert.ok(rgb.every((c,j)=>Math.abs(c-[21,46,43][j])<=2),`world leaked into letterbox at ${x},${y}: ${rgb}`);}
  return points.length;
 }
 async function run(url,fullCanvas,dpr=1){
  const context=await browser.newContext({viewport:sizes[0],deviceScaleFactor:dpr}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){
   const url=m.location().url;
   if(url&&new URL(url).pathname==='/favicon.ico'&&m.text().includes('404'))hostWarnings.push({url,message:m.text()});
   else errors.push(`${m.text()} [${url}]`);
  }});
  page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});
  if(fullCanvas)await page.addInitScript(()=>{const style=document.createElement('style');style.textContent='html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;background:#152e2b!important;overflow:hidden!important}#GameDiv{width:100vw!important;height:100vh!important}';document.addEventListener('DOMContentLoaded',()=>document.head.appendChild(style));});
  await page.goto(url);await page.waitForTimeout(3500);
  await page.waitForFunction(async()=>{try{const cc=await System.import('cc');return cc.director.getScene()?.getChildByName('Canvas')?.getComponent('AdventureGame')?.ready;}catch{return false;}},{},{timeout:45000});
  const kind=url.includes('9527')?'editor':fullCanvas?'native-frame':'web';
  for(const viewport of sizes){
   console.log('Checking',kind,'DPR',dpr,viewport.name);
   await page.setViewportSize({width:viewport.width,height:viewport.height});await page.waitForTimeout(400);
   let s=await data(page);assert.equal(s.mask,true);assert.deepEqual(s.size,{width:1280,height:720});
   assert.ok(Math.abs(s.rect.w/s.rect.h-16/9)<0.006,`incorrect aspect: ${JSON.stringify(s.rect)}`);
   assert.ok(s.rect.x>=-1&&s.rect.y>=-1&&s.rect.x+s.rect.w<=viewport.width+1&&s.rect.y+s.rect.h<=viewport.height+1);
   if(s.mode!=='play') {if(s.mode==='paused')await click(page,s.rect,640,s.modal.includes('在树荫下')?389:468);else throw new Error(`Unexpected mode ${s.mode}`);}
   await page.waitForTimeout(80);
   assert.equal((await data(page)).mode,'play');
   const png=await page.screenshot(),samples=checkPixels(png,viewport,s.rect);
   await page.keyboard.press('Escape');s=await data(page);assert.equal(s.mode,'paused');
   const paused=await page.screenshot();checkPixels(paused,viewport,s.rect);
   // The dimmer must cover both top corners of the complete game area.
   const before=PNG.sync.read(png),after=PNG.sync.read(paused),scaleX=after.width/viewport.width,scaleY=after.height/viewport.height;
   for(const edge of [16,1264]){
    const x=Math.floor((s.rect.x+edge/1280*s.rect.w)*scaleX),y=Math.floor((s.rect.y+15/720*s.rect.h)*scaleY),i=(y*after.width+x)*4;
    assert.ok(after.data[i]+after.data[i+1]+after.data[i+2]<before.data[i]+before.data[i+1]+before.data[i+2]-40,'modal dimmer misses an edge');
   }
   if(viewport.name==='embedded-wide'&&dpr===1)fs.writeFileSync(`docs/适配-${kind}-宽屏.png`,paused);
   if(viewport.name==='portrait'&&kind==='web'&&dpr===1)fs.writeFileSync('docs/适配-竖屏.png',paused);
   await click(page,s.rect,640,389);await page.waitForTimeout(80);assert.equal((await data(page)).mode,'play');
   await page.mouse.move(s.rect.x+939/1280*s.rect.w,s.rect.y+607/720*s.rect.h);await page.mouse.down();await page.waitForTimeout(60);
   s=await data(page);assert.equal(s.touch,true,'attack button coordinates drifted');assert.ok(s.attackTime>0);
   await page.mouse.up();await page.waitForTimeout(350);assert.equal((await data(page)).touch,false);
   results.push({kind,dpr,viewport:viewport.name,engine:s.engine,rect:s.rect,letterboxSamples:samples,modal:true,pointer:true});
  }
  if(!fullCanvas&&kind==='web'){
   await page.setViewportSize({width:960,height:540});await page.addStyleTag({content:':root{--safe-left:24px;--safe-right:30px;--safe-top:10px;--safe-bottom:16px}'});
   await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await page.waitForTimeout(500);const s=await data(page);
   assert.ok(s.rect.x>=23&&s.rect.y>=9&&s.rect.x+s.rect.w<=931&&s.rect.y+s.rect.h<=525,'safe area is not respected');
   results.push({kind,dpr,viewport:'safe-area',rect:s.rect});
  }
  await context.close();
 }
 try{
  if(process.env.PREVIEW_ONLY){assert.ok(process.env.PREVIEW_URL,'Set PREVIEW_URL');await run(process.env.PREVIEW_URL,false);}
  else{const url=process.env.GAME_URL||'http://127.0.0.1:7456';await run(url,false);await run(url,true);await run(url,true,2);if(process.env.PREVIEW_URL)await run(process.env.PREVIEW_URL,false);}
  assert.deepEqual(errors,[]);fs.writeFileSync(process.env.PREVIEW_ONLY?'docs/适配预览验证结果.json':'docs/适配验证结果.json',JSON.stringify({passed:true,results,errors,hostWarnings},null,2));console.log('PASS',results.length,'viewport checks; native clipping, modal coverage and pointer input');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
