import { _decorator, Component, Node, UITransform, UIOpacity, Sprite, SpriteFrame, Texture2D,
    ImageAsset, resources, Graphics, Color, Label, HorizontalTextAlignment, VerticalTextAlignment,
    Layers, Rect, Size, Vec2, Vec3, input, Input, KeyCode, EventKeyboard, EventTouch,
    view, ResolutionPolicy, sys, tween, BlockInputEvents, AudioSource, AudioClip, profiler, LabelOutline } from 'cc';
import { GameModel, WORLD, PLATFORMS, COMBAT, GameEvent } from './GameModel';
const { ccclass } = _decorator;
const C = { ink: '#203D38', teal: '#28594F', mint: '#95C9A0', cream: '#FFF8E7', gold: '#E7B765',
    muted: '#A6BCAE', coral: '#DA8265', dark: '#152E2B' };
const SAVE_KEY = 'maplewild-cocos-388-v1';

/** Native Cocos 3.8 scene: Sprite / Graphics / Label / input / resources / AudioSource. */
@ccclass('AdventureGame')
export class AdventureGame extends Component {
    model = new GameModel();
    private root!: Node;
    private world!: Node;
    private ui!: Node;
    private fx!: Graphics;
    private terrain!: Graphics;
    private overlay: Node | null = null;
    private held = new Set<number>();
    private labels: Record<string, Label> = {};
    private bars: Record<string, Graphics> = {};
    private frames: Record<string, SpriteFrame> = {};
    private hero!: Node;
    private heroVisual!: Node;
    private attackFrames: SpriteFrame[] = [];
    private actionHighlights: Record<string, Node> = {};
    private touchAttack = false;
    private combatStatusTime = 0;
    private npc!: Node;
    private monsters: Node[] = [];
    private monsterBars: Graphics[] = [];
    private portal!: Graphics;
    private mapDot!: Graphics;
    private effects: { type: string; x: number; y: number; age: number; face: number }[] = [];
    private bg: Node[] = [];
    private toastLabel!: Label;
    private toastTime = 0;
    private uiClock = 0;
    private saveClock = 0;
    private ready = false;
    private saved = false;
    private dialogConfirm: (() => void) | null = null;
    private audio!: AudioSource;
    private clips: Record<string, AudioClip> = {};
    private muted = false;

    onLoad() {
        profiler.hideStats();
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.SHOW_ALL);
        this.node.getChildByName('EditorPreview')?.destroy();
        this.root = this.nodeUI('GameScreen', this.node, -640, -360, 1280, 720);
        this.root.getComponent(UITransform)!.setAnchorPoint(0, 0);
        this.audio = this.node.addComponent(AudioSource);
        const loading = this.text(this.root, '正在唤醒森林…', 640, 360, 25, C.cream, 700, true);
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this);
        input.on(Input.EventType.KEY_UP, this.keyUp, this);
        if (typeof window !== 'undefined') {
            window.addEventListener('blur', this.onBlur);
            window.addEventListener('beforeunload', this.onBeforeUnload);
        }
        Promise.all([this.loadImage('art/forest'), this.loadImage('art/characters'), this.loadImage('art/hero-attack')]).then(([forest, atlas, attack]) => {
            const make = (texture: Texture2D, r: number[]) => {
                const f = new SpriteFrame(); f.reset({ texture, rect: new Rect(...r as [number, number, number, number]),
                    originalSize: new Size(r[2], r[3]), offset: new Vec2(0, 0) }); return f;
            };
            this.frames.forest = make(forest, [0, 0, forest.width, forest.height]);
            this.frames.hero = make(atlas, [0, 0, 700, 610]);
            this.frames.slime = make(atlas, [730, 150, 510, 440]);
            this.frames.npc = make(atlas, [50, 605, 510, 640]);
            this.frames.boss = make(atlas, [585, 580, 669, 674]);
            const aw = attack.width / 2, ah = attack.height / 2;
            for (let i = 0; i < 4; i++) {
                const frame = make(attack, [i % 2 * aw, Math.floor(i / 2) * ah, aw, ah]);
                frame.name = `hero-attack-${i}`; this.attackFrames.push(frame);
            }
            this.frames.hero.name = 'hero-idle';
            loading.node.destroy();
            try { const raw = sys.localStorage.getItem(SAVE_KEY); if (raw) this.saved = this.model.restore(raw); } catch (_) { /* storage may be unavailable */ }
            this.buildScene(); this.ready = true;
            this.refreshUI(); this.render(0);
            this.showTitle();
        }).catch(err => { loading.string = `资源加载失败，请从 Creator 预览场景\n${err.message}`; console.error(err); });
        ['attack', 'skill', 'jump', 'coin', 'hurt', 'levelup', 'victory'].forEach(name => {
            resources.load(`audio/${name}`, AudioClip, (err, clip) => { if (!err) this.clips[name] = clip; });
        });
    }
    private loadImage(path: string): Promise<Texture2D> {
        return new Promise((resolve, reject) => resources.load(path, ImageAsset, (err, image) => {
            if (err) return reject(err); const t = new Texture2D(); t.image = image; resolve(t);
        }));
    }
    private nodeUI(name: string, parent: Node, x = 0, y = 0, w = 0, h = 0) {
        const n = new Node(name); n.layer = Layers.Enum.UI_2D; parent.addChild(n);
        n.addComponent(UITransform).setContentSize(w, h); n.setPosition(x, y); return n;
    }
    private graphics(parent: Node, name: string, x = 0, y = 0, w = 0, h = 0) {
        return this.nodeUI(name, parent, x, y, w, h).addComponent(Graphics);
    }
    private color(hex: string, alpha = 255) { const c = new Color(); Color.fromHEX(c, hex); c.a = alpha; return c; }
    private rect(g: Graphics, x: number, y: number, w: number, h: number, color: string, radius = 0, alpha = 255) {
        g.fillColor = this.color(color, alpha);
        if (radius) g.roundRect(x, y, w, h, radius); else g.rect(x, y, w, h); g.fill();
    }
    private text(parent: Node, value: string, x: number, y: number, size = 18, color = C.ink, width = 300, center = false, height = 44) {
        const n = this.nodeUI(value.slice(0, 12), parent, x, y, width, height);
        n.getComponent(UITransform)!.setAnchorPoint(center ? 0.5 : 0, 0.5);
        const l = n.addComponent(Label); l.string = value; l.fontSize = size; l.lineHeight = size * 1.45;
        l.fontFamily = 'Microsoft YaHei'; l.color = this.color(color);
        l.horizontalAlign = center ? HorizontalTextAlignment.CENTER : HorizontalTextAlignment.LEFT;
        l.verticalAlign = VerticalTextAlignment.CENTER; l.overflow = Label.Overflow.CLAMP;
        l.enableWrapText = true; return l;
    }
    private panel(parent: Node, x: number, y: number, w: number, h: number, color = C.cream, alpha = 245, radius = 12) {
        const g = this.graphics(parent, 'Panel', x, y, w, h);
        this.rect(g, -w / 2 + 2, -h / 2 - 5, w, h, C.dark, radius, 30);
        this.rect(g, -w / 2, -h / 2, w, h, color, radius, alpha); return g.node;
    }
    private button(parent: Node, label: string, x: number, y: number, w: number, h: number, callback: () => void, dark = true) {
        const n = this.panel(parent, x, y, w, h, dark ? C.teal : '#E8EAD8', 255, 8);
        this.text(n, label, 0, 0, 17, dark ? C.cream : C.teal, w - 10, true, h);
        n.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; callback(); });
        n.on(Node.EventType.MOUSE_ENTER, () => n.setScale(1.025, 1.025, 1));
        n.on(Node.EventType.MOUSE_LEAVE, () => n.setScale(1, 1, 1)); return n;
    }
    private sprite(parent: Node, frame: string, x: number, y: number, w: number, h: number, feet = false) {
        const n = this.nodeUI(frame, parent, x, y, w, h);
        if (feet) n.getComponent(UITransform)!.setAnchorPoint(0.5, 0);
        const s = n.addComponent(Sprite); s.spriteFrame = this.frames[frame]; s.sizeMode = Sprite.SizeMode.CUSTOM;
        n.getComponent(UITransform)!.setContentSize(w, h); return n;
    }
    private buildScene() {
        for (let i = 0; i < 2; i++) this.bg.push(this.sprite(this.root, 'forest', 640 + i * 1280, 435, 1280, 854));
        const haze = this.graphics(this.root, 'Atmosphere');
        this.rect(haze, 0, 0, 1280, 720, '#D8E9D4', 0, 20);
        this.world = this.nodeUI('World', this.root);
        this.terrain = this.graphics(this.world, 'Terrain'); this.drawTerrain();
        this.npc = this.sprite(this.world, 'npc', 400, WORLD.ground - 4, 104, 130, true);
        this.text(this.npc, '草药师 · 莉娅', 0, 156, 14, C.ink, 200, true);
        const npcMarker = this.text(this.npc, '◆', 0, 190, 30, C.gold, 100, true);
        tween(npcMarker.node).repeatForever(tween().by(0.8, { position: new Vec3(0, 7, 0) }).by(0.8, { position: new Vec3(0, -7, 0) })).start();
        [570, 2110].forEach((x, i) => {
            const g = this.graphics(this.world, 'Waystone', x, WORLD.ground);
            this.rect(g, -7, 0, 14, 53, '#876D49', 3); this.rect(g, -38, 40, 76, 31, '#EAD6A6', 7);
            this.text(g.node, i ? '回村 ←' : '圣域 →', 0, 55, 13, C.teal, 100, true);
        });
        this.monsters = this.model.enemies.map(e => {
            const n = this.sprite(this.world, e.boss ? 'boss' : 'slime', e.x, e.y - 2, e.boss ? 238 : 78, e.boss ? 240 : 68, true);
            this.text(n, e.boss ? '古树守卫' : '叶灵', 0, e.boss ? 262 : 83, e.boss ? 19 : 13, C.ink, 220, true);
            this.monsterBars.push(this.graphics(n, 'Health', 0, e.boss ? 245 : 69)); return n;
        });
        this.hero = this.nodeUI('Hero', this.world, 220, WORLD.ground, 139, 121);
        this.heroVisual = this.sprite(this.hero, 'hero', 0, -2, 139, 121, true);
        this.heroVisual.name = 'HeroVisual';
        const heroTag = this.panel(this.hero, 0, 146, 105, 25, C.cream, 225, 6);
        this.text(heroTag, '风之旅人', 0, 0, 13, C.teal, 100, true, 25);
        this.portal = this.graphics(this.world, 'StarlightPortal', 4970, WORLD.ground + 84);
        this.text(this.portal.node, '星光之门', 0, 132, 17, C.cream, 180, true);
        this.fx = this.graphics(this.world, 'Effects');
        this.ui = this.nodeUI('HUD', this.root);
        this.buildUI();
    }
    private drawTerrain() {
        const g = this.terrain;
        this.rect(g, 0, 0, WORLD.width, WORLD.ground, '#4E5540');
        this.rect(g, 0, WORLD.ground - 20, WORLD.width, 20, '#587B4C');
        this.rect(g, 0, WORLD.ground - 7, WORLD.width, 9, '#A9C879');
        PLATFORMS.forEach(p => {
            this.rect(g, p.x, p.y - 34, p.w, 34, '#6B7251', 11);
            this.rect(g, p.x - 4, p.y - 10, p.w + 8, 14, '#9BBE72', 7);
            this.rect(g, p.x + 5, p.y - 3, p.w - 10, 6, '#D1DB9C', 3);
            for (let j = 10; j < p.w - 10; j += 29) this.rect(g, p.x + j, p.y - 31, 9, 7, '#8E9564', 2);
            for (let j = 25; j < p.w; j += 65) {
                g.strokeColor = this.color('#709866'); g.lineWidth = 3;
                g.moveTo(p.x + j, p.y - 32); g.bezierCurveTo(p.x + j - 10, p.y - 55, p.x + j + 15, p.y - 60, p.x + j, p.y - 75); g.stroke();
            }
        });
        for (let x = 25; x < WORLD.width; x += 47) {
            g.fillColor = this.color(x % 3 ? '#82A86B' : '#CCD68E');
            g.moveTo(x, WORLD.ground); g.lineTo(x - 5, WORLD.ground + 15); g.lineTo(x + 4, WORLD.ground + 5);
            g.lineTo(x + 9, WORLD.ground + 20); g.lineTo(x + 10, WORLD.ground); g.close(); g.fill();
            if (x % 5 === 0) { g.fillColor = this.color(C.coral); g.circle(x + 20, WORLD.ground + 9, 4); g.fill(); }
            this.rect(g, x, 103 - (x % 67), 12, 5, '#697158', 2);
        }
        const gate = this.graphics(this.world, 'BlessingGate', 3900, WORLD.ground);
        this.rect(gate, -8, 0, 16, 194, '#607656', 7); this.rect(gate, -55, 176, 110, 25, '#D7C58C', 6);
        this.text(gate.node, '古树圣域', 0, 189, 15, C.teal, 140, true);
    }
    private buildUI() {
        const top = this.graphics(this.ui, 'TopBar'); this.rect(top, 0, 664, 1280, 56, C.cream, 0, 250);
        this.text(this.ui, '✦  枫野物语', 26, 692, 24, C.teal, 220);
        this.text(this.ui, 'MAPLEWILD  /  林间启程', 232, 691, 12, '#73887A', 360);
        this.button(this.ui, '任务 Q', 955, 692, 88, 32, () => this.showQuest(), false);
        this.button(this.ui, '背包 B', 1055, 692, 88, 32, () => this.showBag(), false);
        this.button(this.ui, 'Ⅱ', 1130, 692, 42, 32, () => this.pause(), false);
        this.button(this.ui, '音效 ♪', 1210, 692, 86, 32, () => { this.muted = !this.muted; this.toast(this.muted ? '音效已关闭' : '音效已开启'); }, false);
        const stats = this.panel(this.ui, 167, 610, 286, 82, C.cream, 243);
        const portrait = this.sprite(stats, 'hero', -105, 0, 75, 65);
        this.labels.level = this.text(stats, 'Lv.1  风之旅人', -55, 23, 16, C.teal, 185);
        this.bars.hp = this.graphics(stats, 'HP', -55, -1); this.bars.mp = this.graphics(stats, 'MP', -55, -24);
        this.labels.hp = this.text(stats, '', 35, -1, 11, C.cream, 180, true, 20);
        this.labels.mp = this.text(stats, '', 35, -24, 11, C.cream, 180, true, 20);
        this.labels.zone = this.text(this.ui, '风铃村', 640, 628, 23, C.cream, 300, true);
        this.text(this.ui, '—  风吹过的地方，就是旅途  —', 640, 601, 12, C.cream, 430, true);
        const map = this.panel(this.ui, 1136, 601, 240, 98, C.cream, 236);
        this.text(map, '林间小径', -102, 28, 14, C.teal, 190);
        this.text(map, '村庄          林地          圣域', 0, -24, 11, '#718371', 220, true);
        const mg = this.graphics(map, 'Route'); this.rect(mg, -95, -2, 190, 4, '#CBD5B7', 2);
        [0, 0.43, 0.88].forEach(v => { mg.fillColor = this.color('#92B58C'); mg.circle(-95 + v * 190, 0, 5); mg.fill(); });
        this.mapDot = this.graphics(map, 'PlayerDot');
        const task = this.panel(this.ui, 163, 479, 278, 140, C.cream, 234);
        this.text(task, '冒险委托', -117, 43, 15, C.teal, 210);
        this.text(task, '第一章 · 森林的来信', -117, 12, 18, C.ink, 250);
        this.labels.objective = this.text(task, '', -117, -33, 14, '#637A63', 240, false, 52);
        this.labels.hint = this.text(this.ui, '', 640, 110, 18, C.cream, 720, true);
        const footer = this.graphics(this.ui, 'Footer'); this.rect(footer, 0, 0, 1280, 61, C.dark, 0, 245);
        this.labels.coins = this.text(this.ui, '', 28, 30, 16, C.gold, 230);
        this.text(this.ui, 'A D / ← → 移动 · E 交互 · H 药水', 262, 30, 13, '#B9C7B2', 350);
        this.labels.saved = this.text(this.ui, '本地自动存档', 1125, 30, 11, C.muted, 140);
        const combat = this.panel(this.ui, 865, 30, 428, 36, '#28473D', 225, 8);
        this.labels.combat = this.text(combat, 'J 挥斩 · 长按连击  /  K 枫叶旋风', 0, 0, 14, C.cream, 412, true, 34);
        this.bars.exp = this.graphics(this.ui, 'Experience');
        this.labels.exp = this.text(this.ui, '', 640, 73, 11, C.cream, 400, true, 22);
        this.actionButton('J', '挥斩', 939, 'attack');
        this.actionButton('K', '枫叶旋风', 1030, 'skill');
        this.actionButton('L', '闪避', 1121, 'dash');
        this.actionButton('SPACE', '二段跳', 1212, 'jump');
        const touchLeft = this.button(this.ui, '←', 57, 108, 57, 50, () => {}, false);
        const touchRight = this.button(this.ui, '→', 124, 108, 57, 50, () => {}, false);
        [touchLeft, touchRight].forEach((n, i) => {
            const code = i ? KeyCode.KEY_D : KeyCode.KEY_A;
            n.on(Node.EventType.TOUCH_START, () => this.held.add(code));
            n.on(Node.EventType.TOUCH_END, () => this.held.delete(code));
            n.on(Node.EventType.TOUCH_CANCEL, () => this.held.delete(code));
        });
        this.button(this.ui, 'E 交互', 227, 108, 100, 43, () => this.doAction('interact'), false);
        this.toastLabel = this.text(this.ui, '', 640, 535, 17, C.cream, 1000, true, 56);
    }
    private actionButton(key: string, label: string, x: number, action: string) {
        const n = this.button(this.ui, '', x, 113, 78, 72, () => { if (action !== 'attack') this.doAction(action); });
        n.name = `Action-${action}`;
        const highlight = this.graphics(n, 'ActionFeedback'); highlight.lineWidth = 3; highlight.strokeColor = this.color(C.gold);
        highlight.roundRect(-37, -34, 74, 68, 7); highlight.stroke(); highlight.node.active = false;
        this.actionHighlights[action] = highlight.node;
        if (action === 'attack') {
            n.on(Node.EventType.TOUCH_START, () => { this.touchAttack = true; this.doAction('attack'); });
            n.on(Node.EventType.TOUCH_END, () => { this.touchAttack = false; });
            n.on(Node.EventType.TOUCH_CANCEL, () => { this.touchAttack = false; });
        }
        this.text(n, key, 0, 12, key === 'SPACE' ? 13 : 23, C.gold, 74, true, 28);
        this.labels[action] = this.text(n, label, 0, -17, 12, C.cream, 76, true, 25);
    }
    private doAction(action: string) { if (this.ready) { this.model.action(action); this.processEvents(); } }
    private keyDown(e: EventKeyboard) {
        const first = !this.held.has(e.keyCode); this.held.add(e.keyCode);
        if (!this.ready || !first) return;
        if (e.keyCode === KeyCode.ESCAPE) { if (this.model.quest === 5) return; if (this.overlay) this.closeOverlay(); else this.pause(); return; }
        if (this.overlay) { if ([KeyCode.ENTER, KeyCode.KEY_E].includes(e.keyCode) && this.dialogConfirm) this.dialogConfirm(); return; }
        const actions: Record<number, string> = { [KeyCode.SPACE]: 'jump', [KeyCode.KEY_W]: 'jump', [KeyCode.ARROW_UP]: 'jump',
            [KeyCode.KEY_J]: 'attack', [KeyCode.KEY_K]: 'skill', [KeyCode.KEY_L]: 'dash', [KeyCode.SHIFT_LEFT]: 'dash',
            [KeyCode.KEY_E]: 'interact', [KeyCode.KEY_H]: 'potion' };
        if (actions[e.keyCode]) this.doAction(actions[e.keyCode]);
        if (e.keyCode === KeyCode.KEY_B) this.showBag();
        if (e.keyCode === KeyCode.KEY_Q) this.showQuest();
    }
    private keyUp(e: EventKeyboard) { this.held.delete(e.keyCode); }
    private onBlur = () => { this.held.clear(); this.touchAttack = false; if (this.ready && !this.overlay && this.model.mode === 'play') this.pause(); };
    private onBeforeUnload = () => this.save();
    update(dt: number) {
        if (!this.ready) return;
        const m = this.model;
        m.update(dt, { left: this.held.has(KeyCode.KEY_A) || this.held.has(KeyCode.ARROW_LEFT),
            right: this.held.has(KeyCode.KEY_D) || this.held.has(KeyCode.ARROW_RIGHT) });
        if (m.mode === 'play' && (this.held.has(KeyCode.KEY_J) || this.touchAttack)) m.action('attack');
        this.processEvents(); this.render(dt);
        this.uiClock += dt; this.saveClock += dt;
        if (this.uiClock > 0.1) { this.refreshUI(); this.uiClock = 0; }
        if (this.saveClock > 5 && m.mode === 'play') { this.save(); this.saveClock = 0; }
        this.toastTime -= dt; this.toastLabel.node.active = this.toastTime > 0;
        this.combatStatusTime -= dt;
        if (this.combatStatusTime <= 0) this.labels.combat.string = 'J 挥斩 · 长按连击  /  K 枫叶旋风';
    }
    private render(dt: number) {
        const m = this.model, p = m.player, t = m.time;
        this.world.setPosition(-m.camera, 0);
        this.bg.forEach((n, i) => n.setPosition(640 + i * 1280 - m.camera * 0.13, 435));
        this.hero.setPosition(p.x, p.y);
        const bob = p.grounded && Math.abs(p.vx) > 1 ? Math.sin(t * 17) * 0.035 : Math.sin(t * 3) * 0.012;
        const attacking = p.attackTime > 0;
        const duration = p.attackKind === 'skill' ? COMBAT.skillDuration : COMBAT.meleeDuration;
        const progress = Math.max(0, Math.min(1, 1 - p.attackTime / duration));
        const pose = Math.min(3, Math.floor(progress * 4));
        const visual = this.heroVisual, sprite = visual.getComponent(Sprite)!;
        sprite.spriteFrame = attacking ? this.attackFrames[pose] : this.frames.hero;
        visual.getComponent(UITransform)!.setContentSize(attacking ? 201.6 : 139, attacking ? 163.2 : 121);
        visual.setPosition(attacking ? p.face * Math.sin(progress * Math.PI) * 11 : 0, attacking ? -9.6 : -2);
        visual.angle = attacking ? p.face * [-7, -3, 5, 0][pose] : 0;
        visual.setScale(p.face * (1 - bob), 1 + bob, 1);
        sprite.color = this.color('#FFFFFF', p.invulnerable > 0 && Math.sin(t * 40) > 0 ? 100 : 255);
        this.actionHighlights.attack.active = attacking && p.attackKind === 'attack';
        this.actionHighlights.skill.active = attacking && p.attackKind === 'skill';
        this.monsters.forEach((n, i) => {
            const e = m.enemies[i]; n.active = !e.dead;
            n.setPosition(e.x, e.y - 2 + (e.boss ? 0 : Math.abs(Math.sin(t * 3.5 + i)) * 5));
            const squash = Math.sin(t * (e.boss ? 2 : 4) + i) * 0.025;
            n.setScale(1 + squash, 1 - squash, 1);
            n.getComponent(Sprite)!.color = this.color(e.hit > 0 ? '#FFD2AF' : '#FFFFFF');
            const g = this.monsterBars[i]; g.clear();
            if (e.hp < e.maxHp && !e.dead) {
                const w = e.boss ? 170 : 52; this.rect(g, -w / 2, 0, w, 5, C.dark, 2);
                this.rect(g, -w / 2, 0, w * e.hp / e.maxHp, 5, e.boss ? C.coral : C.mint, 2);
            }
        });
        const portal = this.portal; portal.clear();
        portal.strokeColor = this.color(m.bossDead ? '#EBCB83' : '#7B9481', m.bossDead ? 230 : 140);
        portal.lineWidth = 5; portal.ellipse(0, 0, 43 + Math.sin(t * 2) * 3, 78); portal.stroke();
        portal.strokeColor = this.color(m.bossDead ? '#CFF7CF' : '#506B5C'); portal.lineWidth = 2;
        portal.ellipse(0, 0, 32, 66); portal.stroke();
        if (m.bossDead) { portal.fillColor = this.color('#9EE5CE', 45); portal.ellipse(0, 0, 32, 66); portal.fill(); }
        const fx = this.fx; fx.clear();
        for (let i = 0; i < 25; i++) {
            const x = ((i * 233 + Math.sin(t * 0.5 + i) * 22) % 1280) + m.camera;
            fx.fillColor = this.color('#F6E9A0', 110 + Math.sin(t + i) * 70);
            fx.circle(x, 220 + ((i * 127 + t * 8) % 380), 1.4 + i % 2); fx.fill();
        }
        m.drops.forEach(d => { fx.fillColor = this.color(C.gold); fx.ellipse(d.x, d.y + Math.sin(t * 5) * 3, 7, 10); fx.fill(); });
        m.projectiles.forEach(s => { fx.fillColor = this.color('#E4B46A'); fx.circle(s.x, s.y, 19); fx.fill();
            fx.fillColor = this.color('#FFF3C3'); fx.circle(s.x, s.y, 10); fx.fill(); });
        const boss = m.enemies[10];
        if (boss.phase === 'telegraph' && !boss.dead) {
            this.rect(fx, boss.targetX - 125, WORLD.ground - 3, 250, 12, '#EC8860', 6, 150 + Math.sin(t * 25) * 80);
            fx.strokeColor = this.color('#FFDBA0'); fx.lineWidth = 2;
            fx.moveTo(boss.targetX, WORLD.ground + 20); fx.lineTo(boss.targetX, WORLD.ground + 68); fx.stroke();
        }
        const ageDt = m.mode === 'play' ? Math.min(dt, 0.05) : 0;
        this.effects = this.effects.filter(e => {
            e.age += ageDt; if (e.age > 0.5) return false;
            const alpha = Math.max(0, 1 - e.age / 0.5);
            if (e.type === 'attack' || e.type === 'skill') {
                const skill = e.type === 'skill', radius = (skill ? 160 : 94) + e.age * 45;
                const sweep = Math.min(1, e.age / (skill ? COMBAT.skillDuration : COMBAT.meleeDuration));
                const head = 1.25 - sweep * 2.5, tail = head + 0.95;
                // Draw a moving, outlined blade trail so a miss is visible against the bright forest too.
                [[19, C.ink], [12, skill ? '#A4E4BB' : '#EDB253'], [4, '#FFF7D3']].forEach(([width, color]) => {
                    fx.strokeColor = this.color(color as string, alpha * 245); fx.lineWidth = width as number;
                    for (let j = 0; j <= 18; j++) {
                        const a = head + (tail - head) * j / 18;
                        const x = e.x + e.face * (16 + Math.cos(a) * radius), y = e.y + Math.sin(a) * radius;
                        if (j === 0) fx.moveTo(x, y); else fx.lineTo(x, y);
                    } fx.stroke();
                });
            } else {
                fx.strokeColor = this.color(e.type === 'hurt' ? C.coral : C.gold, alpha * 200); fx.lineWidth = 3;
                fx.circle(e.x, e.y, e.age * (e.type === 'bossslam' ? 400 : 130) + 9); fx.stroke();
                for (let j = 0; j < 7; j++) {
                    const a = j * Math.PI * 2 / 7;
                    fx.fillColor = this.color('#FFE6A4', alpha * 220); fx.circle(e.x + Math.cos(a) * e.age * 150, e.y + Math.sin(a) * e.age * 150, 3); fx.fill();
                }
            } return true;
        });
    }
    private refreshUI() {
        const m = this.model, p = m.player;
        this.labels.level.string = `Lv.${p.level}  风之旅人`;
        this.labels.hp.string = `${Math.ceil(p.hp)} / ${p.maxHp}`;
        this.labels.mp.string = `${Math.floor(p.mp)} / ${p.maxMp}`;
        [['hp', p.hp / p.maxHp, C.coral], ['mp', p.mp / p.maxMp, '#6AACA5']].forEach(([key, ratio, color]) => {
            const g = this.bars[key as string]; g.clear(); this.rect(g, 0, -7, 178, 14, '#DAE1CB', 5);
            this.rect(g, 0, -7, Math.max(1, 178 * Number(ratio)), 14, color as string, 5);
        });
        this.labels.zone.string = m.zone; this.labels.objective.string = m.objective;
        this.labels.coins.string = `◆ ${p.coins} 金币    ✚ ${p.potions} 药水`;
        this.labels.hint.string = m.hint;
        this.labels.exp.string = `EXP  ${p.exp} / ${m.expNeeded}`;
        const exp = this.bars.exp; exp.clear(); this.rect(exp, 0, 61, 1280, 5, '#52674D');
        this.rect(exp, 0, 61, 1280 * p.exp / m.expNeeded, 5, C.gold);
        const dot = this.mapDot; dot.clear(); dot.fillColor = this.color(C.coral); dot.circle(-95 + p.x / WORLD.width * 190, 0, 6); dot.fill();
        this.labels.skill.string = p.skillCd > 0 ? `${p.skillCd.toFixed(1)}s` : '枫叶旋风';
        this.labels.dash.string = p.dashCd > 0 ? `${p.dashCd.toFixed(1)}s` : '闪避';
    }
    private processEvents() {
        this.model.drainEvents().forEach(e => {
            if (e.type === 'attack' || e.type === 'skill') {
                const name = e.type === 'attack' ? '挥斩' : '枫叶旋风';
                this.labels.combat.string = e.hits ? `${name} · 命中 ${e.hits} 只魔物` : `${name} · 未命中，靠近面前的魔物`;
                this.combatStatusTime = 1.8;
            }
            if (e.type === 'toast') this.toast(e.text!);
            else if (e.type === 'dialog') this.showDialog(e.kind!);
            else if (e.type === 'save') this.save();
            else if (e.type === 'victory') { this.playSound('victory'); this.showVictory(); }
            else {
                if (e.x !== undefined) this.effects.push({ type: e.type, x: e.x, y: e.y || 0, age: 0, face: e.value || 1 });
                if (['damage', 'hurt', 'heal', 'coin', 'levelup'].includes(e.type)) this.floatText(e);
                this.playSound(e.type);
            }
        });
    }
    private floatText(e: GameEvent) {
        const color = e.type === 'hurt' ? '#FFAD91' : e.type === 'heal' ? '#C9FFB4' : e.type === 'levelup' ? '#FFF1AB' : C.cream;
        const l = this.text(this.world, e.text || `${e.type === 'hurt' ? '−' : ''}${e.value}`, e.x!, e.y!, e.type === 'levelup' ? 27 : 23, color, 350, true);
        const outline = l.node.addComponent(LabelOutline); outline.color = this.color(C.dark); outline.width = 2;
        const opacity = l.node.addComponent(UIOpacity);
        tween(l.node).by(0.8, { position: new Vec3(0, 65, 0) }).call(() => l.node.destroy()).start();
        tween(opacity).delay(0.35).to(0.45, { opacity: 0 }).start();
    }
    private playSound(name: string) { if (!this.muted && this.clips[name]) this.audio.playOneShot(this.clips[name], 0.24); }
    private toast(text: string) { if (this.toastLabel) { this.toastLabel.string = text; this.toastTime = 4; this.toastLabel.node.active = true; } }
    private save() {
        if (!this.ready) return;
        try { sys.localStorage.setItem(SAVE_KEY, this.model.serialize()); this.saved = true; }
        catch (_) { if (this.labels.saved) this.labels.saved.string = '当前环境无法存档'; }
    }
    private modal(w = 620, h = 390) {
        this.closeOverlay(false); this.held.clear(); this.touchAttack = false; this.model.mode = 'paused';
        const n = this.nodeUI('Modal', this.root, 0, 0, 1280, 720); n.getComponent(UITransform)!.setAnchorPoint(0, 0);
        n.addComponent(BlockInputEvents); const dim = this.graphics(n, 'Dim'); this.rect(dim, 0, 0, 1280, 720, C.dark, 0, 155);
        this.overlay = n; return this.panel(n, 640, 352, w, h, C.cream, 255, 18);
    }
    private closeOverlay(resume = true) {
        if (this.overlay) this.overlay.destroy(); this.overlay = null; this.dialogConfirm = null; this.held.clear(); this.touchAttack = false;
        if (resume) this.model.mode = this.model.quest === 5 ? 'victory' : 'play';
    }
    private showTitle() {
        const n = this.modal(750, 440);
        this.text(n, 'A LITTLE ADVENTURE IN THE WOODS', 0, 168, 12, '#88967B', 690, true);
        this.text(n, '枫野物语', 0, 103, 59, C.teal, 690, true, 90);
        this.text(n, '沿着风，去冒险。', 0, 39, 23, '#8D7753', 690, true);
        this.text(n, '一封来自森林的委托，一段属于你的横版冒险。\n跳上树梢、击退叶灵，唤醒沉睡的古树。', 0, -18, 17, '#70816B', 640, true, 66);
        const start = () => { this.closeOverlay(); if (this.model.quest === 5) this.showVictory(); else this.toast('向右走到莉娅身边，按 E 接取你的第一份委托'); };
        this.button(n, this.saved ? '继续旅途  →' : '踏上旅途  →', 0, -100, 245, 52, start);
        this.dialogConfirm = start;
        this.text(n, 'A D 移动  /  空格二段跳  /  J 攻击  /  K 技能  /  E 交互', 0, -163, 13, '#8A957E', 700, true);
    }
    private showDialog(kind: string) {
        const n = this.modal(700, 345);
        this.sprite(n, 'npc', -245, -25, 145, 182);
        this.text(n, '草药师 · 莉娅', -132, 110, 23, C.teal, 440);
        const messages: Record<string, string> = {
            offer: '旅人，欢迎来到风铃村！\n森林里的叶灵变得躁动不安。请收集 5 片森林叶片，帮我调制安抚古树的药剂吧。\n\n奖励：80 金币、80 经验、3 瓶药水',
            reward: '太好了，这正是我需要的叶片！\n古树的祝福已经为你开启圣域。村口的风铃路碑能送你过去。\n\n留意守卫脚下的橙色预警，跳跃或闪避可以躲开它的震击。',
            talk: this.model.quest >= 3 ? '古树正在等待你。\n在守卫蓄力时离开橙色区域，跳跃躲过沿地面袭来的能量。\n\n我会帮你恢复状态，并把药水补足到 3 瓶。' : `别着急，森林会回应有耐心的旅人。\n当前叶片：${this.model.leaves} / 5\n\n让我为你恢复生命与魔力，补足药水。`,
        };
        this.text(n, messages[kind], -132, 0, 16, '#667960', 440, false, 175);
        const confirm = () => { this.closeOverlay(); this.model.confirmDialog(kind); this.processEvents(); this.refreshUI(); };
        this.button(n, kind === 'offer' ? '接受委托' : kind === 'reward' ? '领取奖励' : '谢谢你，莉娅', 90, -117, 210, 44, confirm);
        this.dialogConfirm = confirm;
    }
    private showBag() {
        if (!this.ready) return; const n = this.modal(600, 350), p = this.model.player;
        this.text(n, '旅人的行囊', -250, 120, 27, C.teal, 500);
        this.text(n, `◆ 金币  ${p.coins}         ◇ 森林叶片  ${this.model.leaves} / 5`, -250, 63, 18, '#88734F', 520);
        this.text(n, `✚  恢复药水 × ${p.potions}\n恢复 65 点生命，战斗中按 H 快速使用。\n\n枫光短剑 · 攻击 ${this.model.attackPower}   /   等级 ${p.level}`, -250, -18, 17, '#64775F', 520, false, 120);
        this.button(n, '使用药水 H', -107, -119, 190, 43, () => { this.closeOverlay(); this.doAction('potion'); });
        this.button(n, '返回冒险', 108, -119, 190, 43, () => this.closeOverlay(), false);
    }
    private showQuest() {
        if (!this.ready) return; const n = this.modal(630, 365);
        this.text(n, '第一章 · 森林的来信', -265, 126, 26, C.teal, 540);
        this.text(n, this.model.objective, -265, 72, 20, '#9F784A', 540);
        this.text(n, '① 与村里的莉娅交谈，接取叶片委托\n② 击败叶灵，收集 5 片叶片\n③ 回村领取奖励，使用路碑前往圣域\n④ 击败古树守卫，在星光之门按 E', -265, -22, 17, '#65785F', 550, false, 145);
        this.button(n, '继续冒险', 0, -126, 215, 45, () => this.closeOverlay());
    }
    private pause() {
        if (!this.ready) return;
        const n = this.modal(550, 340); this.save();
        this.text(n, '在树荫下歇一会儿', 0, 97, 29, C.teal, 510, true);
        this.text(n, '冒险进度已保存在这台设备上。', 0, 44, 16, '#788571', 510, true);
        const resume = () => this.closeOverlay(); this.dialogConfirm = resume;
        this.button(n, '继续冒险', 0, -21, 260, 48, resume);
        this.button(n, '重新开始…', 0, -87, 260, 43, () => this.confirmRestart(), false);
    }
    private confirmRestart() {
        const n = this.modal(550, 300);
        this.text(n, '重新踏上旅途？', 0, 90, 28, C.teal, 510, true);
        this.text(n, '这会清除当前等级、金币和任务存档。', 0, 31, 16, '#7D8269', 510, true);
        this.button(n, '保留进度', -115, -72, 190, 46, () => this.pause(), false);
        this.button(n, '确认重新开始', 115, -72, 190, 46, () => this.restart());
    }
    private restart() {
        this.closeOverlay(); this.model = new GameModel(); this.effects = []; this.save(); this.refreshUI(); this.toast('新的故事开始了。向右寻找莉娅吧');
    }
    private showVictory() {
        const n = this.modal(660, 390); this.model.mode = 'victory';
        this.text(n, '✦', 0, 130, 42, '#C2964F', 500, true, 60);
        this.text(n, '森林，记住了你的名字。', 0, 65, 32, C.teal, 620, true);
        this.text(n, `古树恢复宁静，新的道路已经打开。\n旅人等级 ${this.model.player.level}   ·   击败 ${this.model.kills} 只魔物   ·   金币 ${this.model.player.coins}`, 0, -2, 17, '#74816A', 610, true, 80);
        this.button(n, '再来一场冒险', 0, -100, 260, 49, () => this.confirmRestart());
        this.text(n, '第一章完成  /  感谢你的游玩', 0, -155, 12, '#9B9E85', 600, true);
    }
    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this); input.off(Input.EventType.KEY_UP, this.keyUp, this);
        if (typeof window !== 'undefined') { window.removeEventListener('blur', this.onBlur); window.removeEventListener('beforeunload', this.onBeforeUnload); }
    }
}
