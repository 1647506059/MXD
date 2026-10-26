# 枫野物语 · Maplewild

使用 **Cocos Creator 3.8.8 + TypeScript** 制作的原创横版动作 RPG 单人原型。保留经典横版冒险的跳台、打怪、成长与村庄任务体验，角色、场景与世界观使用原创素材。

## 启动

1. 用 **Cocos Creator 3.8.8** 打开本目录 `E:\MmSpace\__aaa__demo\MXD`。
2. 在资源管理器打开 `assets/scenes/ForestAdventure.scene`。
3. 点击 Creator 的预览按钮。推荐窗口为 1280 × 720。

本目录保留了原有 `assets/scene.scene`；游戏入口是新建的 `ForestAdventure.scene`。

## 操作

| 按键 | 功能 |
| --- | --- |
| A / D 或 ← / → | 左右移动 |
| Space / W / ↑ | 跳跃；空中再按一次进行二段跳 |
| J | 挥斩，可长按连续攻击 |
| K | 枫叶旋风，消耗 18 魔力 |
| L / 左 Shift | 闪避，短暂加速与无敌 |
| E | NPC、路碑、传送门交互 |
| H | 使用恢复药水 |
| B / Q | 背包 / 任务 |
| Esc | 暂停或关闭弹窗 |

也可以点击屏幕下方的方向、技能和交互按钮。游戏会自动存档；暂停菜单提供带确认的重新开始。

挥斩包含四帧角色动作与刀光，底栏会提示命中或未命中。J 和屏幕“挥斩”按钮都支持按住连续攻击，松开停止。

游戏按 1280 × 720 等比适配，宽屏或竖屏保留居中留边，地图、HUD 和弹窗统一裁剪。支持运行中缩放窗口，网页版本同时处理移动浏览器动态高度和安全区域。详见 [适配说明](docs/适配说明.md)。

## 完整流程

走到莉娅身边按 E 接取委托 → 向右击败 5 只叶灵 → 使用林中路碑回村 → 向莉娅交任务 → 村口路碑传送至圣域 → 躲避预警和地面能量，击败守卫 → 在最右侧传送门按 E 通关。

## 构建与验证

```powershell
npm test
npm run typecheck
npm run build
npm run preview
```

构建脚本默认使用本机 `D:/Softwares/CocosDashboard/resources/editors/Creator/3.8.8/CocosCreator.exe`。其他机器可以执行 `powershell -File tools/build.ps1 -Creator '你的3.8.8路径/CocosCreator.exe'`。预览地址为 `http://127.0.0.1:7456`；这是 Cocos 构建产物的本地服务。

测试脚本可以使用本机 Creator 随附的 TypeScript，无需安装 npm 依赖。其他机器可以先安装 TypeScript，或设置 `COCOS_TYPESCRIPT` 指向 Creator 的 TypeScript 包。

## 项目内容

- [游戏策划案](docs/游戏策划案.md)：玩法、数值、任务、关卡、首领设计和当前范围。
- [美术资源说明](docs/美术资源说明.md)：资源规格、提示词、图集坐标和使用方式。
- [验证记录](docs/验证记录.md)：引擎、构建、规则测试与真实 Cocos 构建的浏览器验证结果。
- [适配说明](docs/适配说明.md)：嵌入预览、窗口缩放、横竖屏与安全区域验证。
- `assets/scripts/GameModel.ts`：与渲染分离的规则、碰撞、AI、成长、任务与存档。
- `assets/scripts/AdventureGame.ts`：原生 Cocos Sprite、Graphics、Label、输入、界面与音效。
- `assets/resources/art/`：AI 生成的原创森林背景、透明角色图集、图集说明。
- `assets/prefabs/`：四个可直接拖入场景的角色美术预制体。
- `assets/resources/audio/`：程序合成的原创反馈音效。
- `tools/prepare-project.cjs`：重建资源元数据、游戏场景、角色单图、预制体和合成音效。执行前需要 `npm install`；修改过生成场景后请勿直接重跑，以免覆盖该场景的手动修改。

当前交付是完整单人第一章原型，挥斩使用四帧角色动画，移动与待机配合位移、翻转和呼吸效果；不包含联网、多职业转职、多人经济、完整跑跳受击动画和后续章节。
