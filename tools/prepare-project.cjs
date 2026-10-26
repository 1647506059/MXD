/* Reproducible scene + metadata + original synthesized audio generation. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '..');
const editor = process.env.COCOS_CREATOR_HOME || 'D:/Softwares/CocosDashboard/resources/editors/Creator/3.8.8';
const write = (p, v) => { const dest = path.join(root, p); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, typeof v === 'string' ? v : JSON.stringify(v, null, 2)); };
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const uuid = name => { const h = crypto.createHash('md5').update('maplewild-388/' + name).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const ids = { scene: uuid('ForestAdventure'), script: uuid('AdventureGame') };
// Script class IDs use Creator's 23-character form (first five hex digits retained).
function compressed(id) { const h = id.replace(/-/g, ''); const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let s = h.slice(0, 5); for (let i = 5; i < 32; i += 3) { const n = parseInt(h.slice(i,i+3), 16); s += b64[n >> 6] + b64[n & 63]; } return s; }
for (const file of ['GameModel', 'AdventureGame']) write(`assets/scripts/${file}.ts.meta`, { ver: '4.0.24', importer: 'typescript', imported: true, uuid: uuid(file), files: [], subMetas: {}, userData: {} });
for (const dir of ['assets/scenes', 'assets/resources/art', 'assets/resources/audio', 'assets/prefabs']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    if (!fs.existsSync(path.join(root, dir + '.meta'))) write(dir + '.meta', { ver: '1.2.0', importer: 'directory', imported: true, uuid: uuid(dir), files: [], subMetas: {}, userData: {} });
}
for (const name of ['forest', 'characters']) {
    const buf = fs.readFileSync(path.join(root, `assets/resources/art/${name}.png`));
    const width = buf.readUInt32BE(16), height = buf.readUInt32BE(20), id = uuid(name);
    write(`assets/resources/art/${name}.png.meta`, { ver: '1.0.27', importer: 'image', imported: true, uuid: id, files: ['.json', '.png'],
        subMetas: { '6c48a': { importer: 'texture', uuid: `${id}@6c48a`, displayName: name, id: '6c48a', name: 'texture', ver: '1.0.22', imported: true, files: ['.json'], subMetas: {},
            userData: { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0, isUuid: true, imageUuidOrDatabaseUri: id } } },
        userData: { type: 'texture', hasAlpha: name === 'characters', fixAlphaTransparencyArtifacts: false, redirect: `${id}@6c48a`, width, height } });
}
const frames = { hero:[0,0,700,610], slime:[730,150,510,440], npc:[50,605,510,640], boss:[585,580,669,674] };
const atlasPixels = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/resources/art/characters.png')));
// Deterministic atlas extraction, preserving alpha and the unmodified original.
for (const [name, [x,y,w,h]] of Object.entries(frames)) {
    const out = new PNG({width:w,height:h}); PNG.bitblt(atlasPixels,out,x,y,w,h,0,0);
    fs.writeFileSync(path.join(root,`assets/resources/art/${name}.png`),PNG.sync.write(out));
}
const white = new PNG({width:2,height:2}); white.data.fill(255);
fs.writeFileSync(path.join(root,'assets/resources/art/white.png'),PNG.sync.write(white));
function makeSpriteMeta(name) {
    const file=`assets/resources/art/${name}.png`, buf=fs.readFileSync(path.join(root,file));
    const w=buf.readUInt32BE(16), h=buf.readUInt32BE(20), id=uuid(name);
    let meta=fs.existsSync(path.join(root,file+'.meta')) ? read(file+'.meta') : {ver:'1.0.27',importer:'image',imported:true,uuid:id,files:['.json','.png'],subMetas:{},userData:{}};
    meta.subMetas['6c48a'] = {ver:'1.0.22',importer:'texture',imported:true,uuid:`${id}@6c48a`,displayName:name,id:'6c48a',name:'texture',files:['.json'],subMetas:{},
        userData:{wrapModeS:'clamp-to-edge',wrapModeT:'clamp-to-edge',minfilter:'linear',magfilter:'linear',mipfilter:'none',anisotropy:0,isUuid:true,imageUuidOrDatabaseUri:id}};
    meta.subMetas.f9941 = {ver:'1.0.12',importer:'sprite-frame',imported:true,uuid:`${id}@f9941`,displayName:name,id:'f9941',name:'spriteFrame',files:['.json'],subMetas:{},
        userData:{trimType:'none',trimThreshold:1,rotated:false,offsetX:0,offsetY:0,trimX:0,trimY:0,width:w,height:h,rawWidth:w,rawHeight:h,
            borderTop:0,borderBottom:0,borderLeft:0,borderRight:0,packable:false,pixelsToUnit:100,pivotX:0.5,pivotY:0.5,meshType:0,isUuid:true,imageUuidOrDatabaseUri:`${id}@6c48a`,atlasUuid:''}};
    meta.userData={type:'sprite-frame',hasAlpha:true,fixAlphaTransparencyArtifacts:false,redirect:`${id}@f9941`};write(file+'.meta',meta);
}
['forest','hero','slime','npc','boss','white'].forEach(makeSpriteMeta);
require('./prepare-attack.cjs');
const scene = JSON.parse(fs.readFileSync(path.join(editor, 'resources/resources/3d/engine/editor/assets/default_file_content/scene/scene-2d.scene'), 'utf8'));
scene[0]._name = 'ForestAdventure'; scene[1]._name = 'ForestAdventure'; scene[1]._id = ids.scene;
scene[2]._lpos.x = 640; scene[2]._lpos.y = 360;
scene[5]._contentSize = { __type__: 'cc.Size', width: 1280, height: 720 };
scene[4]._color = { __type__: 'cc.Color', r: 32, g: 61, b: 56, a: 255 }; scene[4]._orthoHeight = 360;
scene[2]._components.push({ __id__: scene.length });
scene.push({ __type__: compressed(ids.script), _name: '', _objFlags: 0, node: { __id__: 2 }, _enabled: true, __prefab: null, _id: uuid('GameComponent') });
const baseNode = JSON.parse(JSON.stringify(scene[2]));
function addVisual(table, parent, name, x, y, w, h, frame, color=[255,255,255], anchorY=0.5) {
    const index=table.length, node=JSON.parse(JSON.stringify(baseNode));
    Object.assign(node,{_name:name,_parent:parent===null?null:{__id__:parent},_children:[],_components:[{__id__:index+1},{__id__:index+2}],_lpos:{__type__:'cc.Vec3',x,y,z:0},_id:uuid('node/'+name)});
    table.push(node,{__type__:'cc.UITransform',_name:'',_objFlags:0,node:{__id__:index},_enabled:true,__prefab:null,
        _contentSize:{__type__:'cc.Size',width:w,height:h},_anchorPoint:{__type__:'cc.Vec2',x:0.5,y:anchorY},_id:uuid('transform/'+name)},
        {__type__:'cc.Sprite',_name:'',_objFlags:0,node:{__id__:index},_enabled:true,__prefab:null,
            _customMaterial:null,_color:{__type__:'cc.Color',r:color[0],g:color[1],b:color[2],a:255},_spriteFrame:{__uuid__:uuid(frame)+'@f9941',__expectedType__:'cc.SpriteFrame'},_type:0,_sizeMode:0,_fillType:0,_fillCenter:{__type__:'cc.Vec2',x:0,y:0},_fillStart:0,_fillRange:0,_isTrimmedMode:true,_useGrayscale:false,_id:uuid('sprite/'+name)});
    if(parent!==null)table[parent]._children.push({__id__:index}); return index;
}
const preview=scene.length, previewNode=JSON.parse(JSON.stringify(baseNode));
Object.assign(previewNode,{_name:'EditorPreview',_parent:{__id__:2},_children:[],_components:[],_lpos:{__type__:'cc.Vec3',x:0,y:0,z:0},_id:uuid('preview')});
scene.push(previewNode);scene[2]._children.push({__id__:preview});
addVisual(scene,preview,'ForestBackdrop',0,0,1280,720,'forest');
addVisual(scene,preview,'Earth',0,-288,1280,144,'white',[78,85,64]);
addVisual(scene,preview,'Grass',0,-221,1280,10,'white',[169,200,121]);
addVisual(scene,preview,'Hero',-420,-216,139,121,'hero',[255,255,255],0);
addVisual(scene,preview,'Herbalist',-240,-216,104,130,'npc',[255,255,255],0);
addVisual(scene,preview,'LeafSpirit',100,-216,78,68,'slime',[255,255,255],0);
addVisual(scene,preview,'AncientGuardian',420,-216,238,240,'boss',[255,255,255],0);
// Editable visual prefabs for art iteration; simulation creates its own view instances.
for(const [name,frame,w,h] of [['Hero','hero',139,121],['LeafSpirit','slime',78,68],['Herbalist','npc',104,130],['AncientGuardian','boss',238,240]]) {
    const table=[{__type__:'cc.Prefab',_name:name,_objFlags:0,_native:'',data:{__id__:1},optimizationPolicy:0,persistent:false}];
    const index=addVisual(table,null,name,0,0,w,h,frame,[255,255,255],0);
    table[index]._prefab={__id__:table.length}; table.push({__type__:'cc.PrefabInfo',root:{__id__:index},asset:{__id__:0},fileId:uuid('prefabinfo/'+name)});
    write(`assets/prefabs/${name}.prefab`,table);write(`assets/prefabs/${name}.prefab.meta`,{ver:'1.1.50',importer:'prefab',imported:true,uuid:uuid('prefab/'+name),files:['.json'],subMetas:{},userData:{}});
}
write('assets/scenes/ForestAdventure.scene', scene);
write('assets/scenes/ForestAdventure.scene.meta', { ver: '1.1.50', importer: 'scene', imported: true, uuid: ids.scene, files: ['.json'], subMetas: {}, userData: {} });
const projectSettings = read('settings/v2/packages/project.json');
projectSettings.general = { ...projectSettings.general, designResolution: { width: 1280, height: 720, fitWidth: false, fitHeight: true } };
write('settings/v2/packages/project.json', projectSettings);
const pkg = read('package.json'); pkg.name = 'MXD-Maplewild'; pkg.type = '2d'; pkg.version = '0.1.0'; pkg.creator = { version: '3.8.8' };
pkg.scripts = { 'assets:prepare': 'node tools/prepare-project.cjs', test: 'node tests/game-model.test.cjs', typecheck:'node tools/typecheck.cjs', 'test:smoke':'node tests/cocos-smoke.cjs', 'test:attack':'node tests/attack-feedback.cjs', 'test:viewport':'node tests/viewport-adaptation.cjs', build: 'powershell -ExecutionPolicy Bypass -File tools/build.ps1', preview: 'node tools/serve.cjs' }; write('package.json', pkg);
write('buildConfig_web-desktop.json', { name: 'Maplewild', platform: 'web-desktop', buildPath: 'project://build', outputName: 'web-desktop',
    scenes: [{ url: 'db://assets/scenes/ForestAdventure.scene', uuid: ids.scene }], startScene: ids.scene,
    debug: true, sourceMaps: true, md5Cache: false, replaceSplashScreen: true, mainBundleCompressionType: 'merge_dep',
    previewWidth: 1280, previewHeight: 720,
    packages: { 'web-desktop': { resolution: { width: 1280, height: 720 }, embedWebDebugger: false } } });
// Generate short, original game feedback sounds; no external recording dependency.
function wav(name, duration, notes, mode = 'sine') {
    const rate = 22050, n = Math.floor(rate * duration), b = Buffer.alloc(44 + n * 2);
    b.write('RIFF'); b.writeUInt32LE(36+n*2,4); b.write('WAVEfmt ',8); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(n*2,40);
    for (let i=0; i<n; i++) { const t=i/rate, part=Math.min(notes.length-1, Math.floor(t/duration*notes.length)); const f=notes[part];
        const phase=2*Math.PI*f*t, envelope=Math.sin(Math.PI * t/duration) * Math.exp(-t/duration*2);
        const v=mode==='sweep' ? Math.sin(phase*(1-t/duration*0.7)) : Math.sin(phase)*0.8+Math.sin(phase*2)*0.15;
        b.writeInt16LE(Math.floor(v*envelope*10500),44+i*2); }
    fs.writeFileSync(path.join(root,`assets/resources/audio/${name}.wav`),b);
    write(`assets/resources/audio/${name}.wav.meta`, { ver: '1.0.9', importer: 'audio-clip', imported: true, uuid: uuid('audio/'+name), files: ['.json','.wav'], subMetas: {}, userData: {} });
}
wav('attack',0.12,[550],'sweep'); wav('skill',0.38,[392,523,784],'sweep'); wav('jump',0.16,[420,660]);
wav('coin',0.16,[880,1320]); wav('hurt',0.17,[160,110]); wav('levelup',0.55,[523,659,784,1046]); wav('victory',1.2,[523,659,784,1046,784,1046]);
write('assets/resources/art/atlas-layout.json', { image: 'characters.png', size: [1254,1254], origin: 'top-left', frames: {
    hero:[0,0,700,610], slime:[730,150,510,440], npc:[50,605,510,640], boss:[585,580,669,674] } });
console.log('Cocos Creator 3.8.8 project prepared. Scene:', ids.scene, 'component:', compressed(ids.script));
