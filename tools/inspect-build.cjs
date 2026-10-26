const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:7456'); await page.waitForTimeout(7000);
 console.log(JSON.stringify(await page.evaluate(async()=>{ const cc=await System.import('cc'); const scene=cc.director.getScene();return {engine:cc.VERSION,scene:scene?.name,nodes:scene?.children.map(n=>({name:n.name,components:n.components.map(c=>c.constructor.name)})),canvas:document.querySelector('canvas')?.getBoundingClientRect().toJSON()};}),null,2));
 await page.screenshot({path:'docs/试玩-标题.png',fullPage:true});
 console.log('ERRORS',JSON.stringify(errors)); await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
