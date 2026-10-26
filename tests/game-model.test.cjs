const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), Module = require('node:module');
let ts;
try { ts = require('typescript'); } catch { ts = require(process.env.COCOS_TYPESCRIPT || 'D:/Softwares/CocosDashboard/resources/editors/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript'); }
const file = path.resolve(__dirname, '../assets/scripts/GameModel.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const mod = new Module(file, module); mod._compile(compiled, file);
const { GameModel, WORLD, PLATFORMS } = mod.exports;
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }
function advance(m, seconds, input = {}) { for (let i = 0; i < Math.ceil(seconds * 60); i++) m.update(1/60, input); }
test('double jump caps at two and resets on landing', () => {
 const m = new GameModel(); m.action('jump'); const vy=m.player.vy; m.action('jump'); assert.equal(m.player.jumps,2); m.action('jump'); assert.equal(m.player.jumps,2);
 advance(m,2); assert.equal(m.player.y,WORLD.ground); assert.equal(m.player.jumps,0); assert.ok(vy>0);
});
test('one-way platforms allow rising through and land from above', () => {
 const m = new GameModel(); m.enemies.forEach(e=>e.dead=true); m.player.x=750; m.action('jump'); advance(m,0.18); m.action('jump'); advance(m,0.12); assert.ok(m.player.y>PLATFORMS[0].y); advance(m,0.9); assert.equal(m.player.y,PLATFORMS[0].y); assert.equal(m.player.grounded,true);
 m.player.x=920; advance(m,0.6); assert.equal(m.player.y,WORLD.ground);
});
test('melee is directional and cooldown prevents duplicate hits', () => {
 const m=new GameModel(); m.player.x=800; m.player.face=1; const e=m.enemies[0]; e.x=850; const hp=e.hp;
 m.action('attack'); assert.equal(e.hp,hp-m.attackPower); m.action('attack'); assert.equal(e.hp,hp-m.attackPower);
 m.player.attackCd=0; m.player.face=-1; m.action('attack'); assert.equal(e.hp,hp-m.attackPower);
});
test('skill costs mana, hits both sides and respects cooldown', () => {
 const m=new GameModel(); m.player.x=900; m.enemies[0].x=820; m.enemies[1].x=1000; m.enemies[1].y=144;
 m.action('skill'); assert.equal(m.player.mp,52); assert.equal(m.enemies[0].hp,2); assert.equal(m.enemies[1].hp,2);
 m.action('skill'); assert.equal(m.player.mp,52); m.player.skillCd=0; m.player.mp=17; m.action('skill'); assert.equal(m.player.mp,17);
});
test('quest requires acceptance, five leaves and one reward claim', () => {
 const m=new GameModel(); m.kill(m.enemies[0]); assert.equal(m.leaves,0);
 m.confirmDialog('offer'); for(let i=1;i<=5;i++) m.kill(m.enemies[i]); assert.equal(m.quest,2); assert.equal(m.leaves,5);
 m.confirmDialog('reward'); const coins=m.player.coins; assert.equal(m.quest,3); assert.equal(coins,80); assert.equal(m.player.potions,8);
 m.confirmDialog('reward'); assert.equal(m.player.coins,coins);
});
test('guardian is protected before quest and telegraph can be dodged', () => {
 const m=new GameModel(); const b=m.enemies[10]; m.player.x=b.x-100; m.action('skill'); assert.equal(b.hp,b.maxHp);
 m.quest=3; b.phase='telegraph'; b.targetX=m.player.x; b.attackTimer=0.01; m.player.y=320; const hp=m.player.hp;
 m.update(1/60); assert.equal(m.player.hp,hp); assert.equal(b.phase,'recover'); assert.equal(m.projectiles.length,2);
});
test('damage invulnerability, death recovery and potion supply', () => {
 const m=new GameModel(); m.quest=2; m.player.coins=100; m.hurt(10,400); m.hurt(10,400); assert.equal(m.player.hp,110);
 m.player.invulnerable=0; m.hurt(999,400); assert.equal(m.player.hp,m.player.maxHp); assert.equal(m.player.coins,90); assert.equal(m.quest,2);
 m.player.hp=30; m.action('potion'); assert.equal(m.player.hp,95); assert.equal(m.player.potions,4);
});
test('drops collect, XP levels up and boss opens victory portal', () => {
 const m=new GameModel(); m.drops.push({x:220,y:156,age:0,value:12}); m.update(1/60); assert.equal(m.player.coins,12);
 m.addExp(70); assert.equal(m.player.level,2); assert.equal(m.player.hp,144); m.quest=3; m.kill(m.enemies[10]); assert.equal(m.quest,4);
 m.player.x=4970; m.action('interact'); assert.equal(m.quest,5); assert.equal(m.mode,'victory');
});
test('save round trip keeps quest, stats and defeated boss; malformed data rejected', () => {
 const m=new GameModel(); m.quest=4; m.bossDead=true; m.enemies[10].dead=true; m.player.coins=222; m.player.x=4200;
 const restored=new GameModel(); assert.equal(restored.restore(m.serialize()),true); assert.equal(restored.quest,4); assert.equal(restored.player.coins,222); assert.equal(restored.enemies[10].dead,true);
 assert.equal(new GameModel().restore('{bad'),false); assert.equal(new GameModel().restore('{"version":2}'),false);
});
test('pause freezes physics and prevents attacks', () => { const m=new GameModel(); m.mode='paused'; const x=m.player.x; m.update(1,{right:true}); m.action('skill'); assert.equal(m.player.x,x); assert.equal(m.player.mp,70); });
console.log(`${passed} gameplay checks passed.`);
