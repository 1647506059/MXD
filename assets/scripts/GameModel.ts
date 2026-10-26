/** Deterministic game rules, independent from Cocos rendering. Units: pixels / seconds. */
export const WORLD = { width: 5200, ground: 144, gravity: 1800, speed: 285, jump: 660 };
export const COMBAT = { meleeDuration: 0.28, skillDuration: 0.38 };
export const PLATFORMS = [
    { x: 650, y: 266, w: 230 }, { x: 1000, y: 380, w: 240 },
    { x: 1410, y: 272, w: 270 }, { x: 1840, y: 392, w: 240 },
    { x: 2280, y: 280, w: 260 }, { x: 2720, y: 386, w: 250 },
    { x: 3150, y: 268, w: 270 }, { x: 3640, y: 350, w: 230 },
];
export type GameEvent = { type: string; x?: number; y?: number; text?: string; value?: number; kind?: string; hits?: number };
export type InputState = { left?: boolean; right?: boolean };
export type Enemy = { id: number; x: number; y: number; home: number; hp: number; maxHp: number;
    dir: number; dead: boolean; timer: number; hit: number; boss: boolean; phase: string; attackTimer: number; targetX: number };
export class GameModel {
    player = { x: 220, y: 144, vx: 0, vy: 0, face: 1, grounded: true, jumps: 0,
        hp: 120, maxHp: 120, mp: 70, maxMp: 70, level: 1, exp: 0, coins: 0, potions: 5,
        invulnerable: 0, attackCd: 0, skillCd: 0, dashCd: 0, dashTime: 0, attackTime: 0, attackKind: 'attack' as 'attack' | 'skill' };
    enemies: Enemy[] = [];
    drops: { x: number; y: number; age: number; value: number }[] = [];
    projectiles: { x: number; y: number; vx: number; life: number }[] = [];
    events: GameEvent[] = [];
    quest = 0; // 0 offer, 1 collect, 2 collect reward, 3 guardian, 4 portal, 5 finished
    leaves = 0;
    kills = 0;
    bossDead = false;
    mode: 'play' | 'paused' | 'dialog' | 'victory' = 'play';
    time = 0;
    camera = 0;
    constructor() {
        [850, 1160, 1510, 1770, 2020, 2390, 2670, 3030, 3320, 3600].forEach((x, id) => {
            const platform = PLATFORMS.find(p => x > p.x && x < p.x + p.w && id % 3 === 1);
            this.enemies.push({ id, x, y: platform ? platform.y : WORLD.ground, home: x,
                hp: 48, maxHp: 48, dir: id % 2 ? -1 : 1, dead: false, timer: 0, hit: 0,
                boss: false, phase: 'patrol', attackTimer: 0, targetX: x });
        });
        this.enemies.push({ id: 10, x: 4480, y: WORLD.ground, home: 4480, hp: 520, maxHp: 520,
            dir: -1, dead: false, timer: 0, hit: 0, boss: true, phase: 'sleep', attackTimer: 1.8, targetX: 4480 });
    }
    emit(type: string, data: Partial<GameEvent> = {}) { this.events.push({ type, ...data }); }
    drainEvents() { const e = this.events; this.events = []; return e; }
    get expNeeded() { return this.player.level * 70; }
    get attackPower() { return 23 + (this.player.level - 1) * 7; }
    get zone() { return this.player.x < 650 ? '风铃村' : this.player.x < 3800 ? '翡翠林地' : '古树圣域'; }
    get objective() {
        return ['与草药师莉娅交谈', `收集森林叶片 ${this.leaves} / 5`, '回风铃村找莉娅领取奖励',
            '击败古树守卫', '前往右侧星光传送门', '旅程完成 · 森林重获宁静'][this.quest];
    }
    get hint() {
        const p = this.player;
        if (Math.abs(p.x - 400) < 110) return 'E  与莉娅交谈';
        if (Math.abs(p.x - 2110) < 90) return 'E  风铃路碑 · 返回村庄';
        if (Math.abs(p.x - 570) < 75 && this.quest >= 3) return 'E  风铃路碑 · 前往古树圣域';
        if (Math.abs(p.x - 4970) < 110) return this.bossDead ? 'E  开启新的旅程' : '击败古树守卫以开启传送门';
        return '';
    }
    action(action: string) {
        if (this.mode !== 'play') return;
        const p = this.player;
        if (action === 'jump' && p.jumps < 2) {
            p.vy = p.jumps === 0 ? WORLD.jump : 590;
            p.jumps++; p.grounded = false;
            this.emit('jump', { x: p.x, y: p.y, value: p.jumps });
        }
        if (action === 'attack' && p.attackCd <= 0) {
            p.attackCd = 0.32; p.attackTime = COMBAT.meleeDuration; p.attackKind = 'attack';
            const hits = this.strike(145, this.attackPower, false);
            this.emit('attack', { x: p.x, y: p.y + 52, value: p.face, hits });
        }
        if (action === 'skill' && p.skillCd <= 0 && p.mp >= 18) {
            p.mp -= 18; p.skillCd = 1.7; p.attackTime = COMBAT.skillDuration; p.attackKind = 'skill';
            const hits = this.strike(270, this.attackPower * 2, true);
            this.emit('skill', { x: p.x, y: p.y + 48, value: p.face, hits });
        } else if (action === 'skill' && p.mp < 18) this.emit('toast', { text: '魔力不足，稍等片刻即可恢复' });
        if (action === 'dash' && p.dashCd <= 0) {
            p.dashCd = 1.1; p.dashTime = 0.17; p.invulnerable = Math.max(p.invulnerable, 0.27);
            this.emit('dash', { x: p.x, y: p.y + 28 });
        }
        if (action === 'potion') {
            if (p.potions > 0 && p.hp < p.maxHp) {
                p.potions--; p.hp = Math.min(p.maxHp, p.hp + 65);
                this.emit('heal', { x: p.x, y: p.y + 85, text: '+65' }); this.emit('save');
            } else this.emit('toast', { text: p.potions <= 0 ? '药水用完了，找莉娅补给' : '生命值已满' });
        }
        if (action === 'interact') this.interact();
    }
    strike(range: number, damage: number, skill: boolean) {
        const p = this.player;
        let hits = 0;
        for (const e of this.enemies) {
            if (e.dead || (e.boss && this.quest < 3)) continue;
            const dx = e.x - p.x;
            if ((skill ? Math.abs(dx) < range : dx * p.face > -35 && dx * p.face < range) && Math.abs(e.y - p.y) < (e.boss ? 170 : 85)) {
                hits++;
                e.hp = Math.max(0, e.hp - damage); e.hit = 0.18;
                if (!e.boss) e.x += p.face * 18;
                this.emit('damage', { x: e.x, y: e.y + (e.boss ? 210 : 75), value: damage, kind: skill ? 'skill' : 'normal' });
                if (!e.hp) this.kill(e);
            }
        }
        return hits;
    }
    kill(e: Enemy) {
        e.dead = true; e.timer = 23; this.kills++;
        this.emit('defeat', { x: e.x, y: e.y + 25, kind: e.boss ? 'boss' : 'slime' });
        this.addExp(e.boss ? 180 : 30);
        this.drops.push({ x: e.x, y: e.y + 12, age: 0, value: e.boss ? 120 : 12 });
        if (e.boss) {
            this.bossDead = true; this.quest = 4; this.projectiles = [];
            this.emit('toast', { text: '古树守卫已被净化！右侧传送门已开启' });
        } else if (this.quest === 1) {
            this.leaves = Math.min(5, this.leaves + 1);
            if (this.leaves === 5) { this.quest = 2; this.emit('toast', { text: '叶片收集完成！在风铃路碑按 E 快速回村' }); }
        }
        this.emit('save');
    }
    addExp(value: number) {
        const p = this.player; p.exp += value;
        while (p.exp >= this.expNeeded) {
            p.exp -= this.expNeeded; p.level++; p.maxHp += 24; p.maxMp += 8;
            p.hp = p.maxHp; p.mp = p.maxMp;
            this.emit('levelup', { x: p.x, y: p.y + 100, text: `LEVEL ${p.level}` });
        }
    }
    interact() {
        const p = this.player;
        if (Math.abs(p.x - 400) < 110) {
            this.mode = 'dialog'; this.emit('dialog', { kind: this.quest === 0 ? 'offer' : this.quest === 2 ? 'reward' : 'talk' });
        } else if (Math.abs(p.x - 2110) < 90) {
            p.x = 475; p.y = WORLD.ground; p.vy = 0; this.camera = 0;
            this.emit('toast', { text: '已回到风铃村' });
        } else if (Math.abs(p.x - 570) < 75 && this.quest >= 3) {
            p.x = 3910; p.y = WORLD.ground; p.vy = 0; this.camera = 3400;
            this.emit('toast', { text: '已抵达古树圣域 · 留意守卫的蓄力范围' });
        } else if (Math.abs(p.x - 4970) < 110 && this.bossDead) {
            this.quest = 5; this.mode = 'victory'; this.emit('victory'); this.emit('save');
        }
    }
    confirmDialog(kind: string) {
        if (kind === 'offer' && this.quest === 0) {
            this.quest = 1; this.emit('toast', { text: '任务已接受 · 击败 5 只叶灵，收集森林叶片' });
        }
        if (kind === 'reward' && this.quest === 2) {
            this.quest = 3; this.player.coins += 80; this.player.potions += 3; this.addExp(80);
            this.player.hp = this.player.maxHp; this.player.mp = this.player.maxMp;
            this.emit('toast', { text: '获得 80 金币、3 瓶药水！右侧路碑可直达古树圣域' });
        }
        if (kind === 'talk') {
            this.player.hp = this.player.maxHp; this.player.mp = this.player.maxMp;
            if (this.player.potions < 3) this.player.potions = 3;
        }
        this.mode = 'play'; this.emit('save');
    }
    hurt(damage: number, sourceX: number) {
        const p = this.player;
        if (p.invulnerable > 0) return;
        p.hp = Math.max(0, p.hp - damage); p.invulnerable = 1;
        p.x = Math.max(36, Math.min(WORLD.width - 36, p.x + (p.x < sourceX ? -28 : 28)));
        this.emit('hurt', { x: p.x, y: p.y + 90, value: damage });
        if (!p.hp) {
            p.x = 250; p.y = WORLD.ground; p.vx = p.vy = 0; p.jumps = 0; p.grounded = true;
            p.hp = p.maxHp; p.mp = p.maxMp; p.coins = Math.floor(p.coins * 0.9); this.camera = 0;
            p.invulnerable = 3; this.projectiles = [];
            this.emit('toast', { text: '莉娅把你带回了村庄。损失 10% 金币，任务进度保留' }); this.emit('save');
        }
    }
    update(dt: number, input: InputState = {}) {
        if (this.mode !== 'play') return;
        dt = Math.min(dt, 1 / 30); this.time += dt;
        const p = this.player;
        ['invulnerable', 'attackCd', 'skillCd', 'dashCd', 'dashTime', 'attackTime'].forEach(k => p[k] = Math.max(0, p[k] - dt));
        p.mp = Math.min(p.maxMp, p.mp + dt * 5);
        const axis = Number(!!input.right) - Number(!!input.left);
        if (axis && p.dashTime <= 0) p.face = axis;
        p.vx = p.dashTime > 0 ? p.face * 900 : axis * WORLD.speed;
        p.x = Math.max(35, Math.min(WORLD.width - 35, p.x + p.vx * dt));
        if (this.quest < 3 && p.x > 3860) { p.x = 3860; this.emit('toast', { text: '需要先完成莉娅的委托，取得古树祝福' }); }
        const prevY = p.y;
        p.vy -= WORLD.gravity * dt; p.y += p.vy * dt; p.grounded = false;
        let floor = WORLD.ground;
        if (p.vy <= 0) for (const s of PLATFORMS) {
            if (p.x + 17 > s.x && p.x - 17 < s.x + s.w && prevY >= s.y - 1 && p.y <= s.y) floor = Math.max(floor, s.y);
        }
        if (p.y <= floor) { p.y = floor; p.vy = 0; p.grounded = true; p.jumps = 0; }
        this.camera += (Math.max(0, Math.min(WORLD.width - 1280, p.x - 480)) - this.camera) * Math.min(1, dt * 6);
        for (const e of this.enemies) {
            e.hit = Math.max(0, e.hit - dt);
            if (e.dead) {
                e.timer -= dt;
                if (!e.boss && e.timer <= 0 && !this.bossDead && Math.abs(e.x - p.x) > 250) { e.dead = false; e.hp = e.maxHp; e.x = e.home; }
                continue;
            }
            if (e.boss) this.updateBoss(e, dt);
            else {
                e.x += e.dir * dt * 42;
                if (Math.abs(e.x - e.home) > 74) e.dir *= -1;
                if (Math.abs(e.x - p.x) < 43 && Math.abs(e.y - p.y) < 50) this.hurt(12, e.x);
            }
        }
        for (const shot of this.projectiles) {
            shot.x += shot.vx * dt; shot.life -= dt;
            if (Math.abs(shot.x - p.x) < 32 && Math.abs(shot.y - (p.y + 24)) < 43) { this.hurt(22, shot.x); shot.life = 0; }
        }
        this.projectiles = this.projectiles.filter(s => s.life > 0);
        this.drops = this.drops.filter(d => {
            d.age += dt;
            if (Math.abs(d.x - p.x) < 100 && Math.abs(d.y - p.y) < 140 || d.age > 6) {
                p.coins += d.value; this.emit('coin', { x: d.x, y: d.y + 45, text: `+${d.value}` }); this.emit('save'); return false;
            }
            return true;
        });
    }
    updateBoss(e: Enemy, dt: number) {
        if (this.quest < 3 || Math.abs(this.player.x - e.x) > 800) { e.phase = 'sleep'; return; }
        if (e.phase === 'sleep') { e.phase = 'patrol'; e.attackTimer = 1.6; }
        e.attackTimer -= dt;
        e.dir = this.player.x < e.x ? -1 : 1;
        if (e.phase === 'patrol') {
            e.x = Math.max(4130, Math.min(4740, e.x + e.dir * dt * 35));
            if (e.attackTimer <= 0) {
                e.phase = 'telegraph'; e.targetX = this.player.x; e.attackTimer = 0.95;
                this.emit('bosswindup', { x: e.targetX, y: WORLD.ground });
            }
        } else if (e.phase === 'telegraph' && e.attackTimer <= 0) {
            e.phase = 'recover'; e.attackTimer = 1.35;
            if (Math.abs(this.player.x - e.targetX) < 125 && this.player.y < WORLD.ground + 100) this.hurt(30, e.x);
            [-1, 1].forEach(dir => this.projectiles.push({ x: e.x, y: WORLD.ground + 26, vx: dir * 265, life: 3 }));
            this.emit('bossslam', { x: e.targetX, y: WORLD.ground });
        } else if (e.phase === 'recover' && e.attackTimer <= 0) { e.phase = 'patrol'; e.attackTimer = e.hp < e.maxHp / 2 ? 1 : 1.8; }
        if (Math.abs(e.x - this.player.x) < 86 && Math.abs(e.y - this.player.y) < 130) this.hurt(18, e.x);
    }
    serialize() {
        return JSON.stringify({ version: 1, player: this.player, quest: this.quest, leaves: this.leaves,
            kills: this.kills, bossDead: this.bossDead, enemies: this.enemies, drops: this.drops });
    }
    restore(raw: string) {
        try {
            const s = JSON.parse(raw);
            if (s.version !== 1 || !s.player || !Array.isArray(s.enemies) || s.enemies.length !== 11) return false;
            const p = s.player;
            if (![p.x, p.y, p.hp, p.maxHp, p.level, p.mp, p.coins, s.quest, s.leaves].every(Number.isFinite)) return false;
            if (s.quest < 0 || s.quest > 5 || p.level < 1 || p.maxHp < 1 || s.enemies.some(e => !Number.isFinite(e.x) || !Number.isFinite(e.hp))) return false;
            Object.assign(this.player, p); this.quest = s.quest; this.leaves = s.leaves; this.kills = s.kills || 0;
            this.bossDead = !!s.bossDead; this.enemies = s.enemies; this.drops = Array.isArray(s.drops) ? s.drops : [];
            this.player.x = Math.max(35, Math.min(WORLD.width - 35, this.player.x));
            this.player.y = WORLD.ground; this.player.vy = this.player.vx = 0; this.player.jumps = 0; this.player.grounded = true;
            this.player.attackTime = this.player.attackCd = this.player.dashTime = 0; this.player.attackKind = 'attack';
            this.player.hp = Math.max(1, Math.min(this.player.maxHp, this.player.hp));
            this.mode = this.quest === 5 ? 'victory' : 'play';
            this.camera = Math.max(0, Math.min(WORLD.width - 1280, this.player.x - 480)); return true;
        } catch (_) { return false; }
    }
}
