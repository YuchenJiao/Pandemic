# Pandemic Command

可自行部署的中文合作桌游网页实现。前端、房间服务器、规则引擎均在此仓库；没有外部运行时依赖。无需 OpenAI、Cloudflare、API key 或专有托管服务。

这是非官方爱好者项目，使用原创界面与地图绘制，不附带发行商的地图、卡面图片或规则书 PDF。

## 本地运行

安装 Node.js 22 或 24，然后在仓库根目录运行：

```bash
npm ci
npm start
```

打开 <http://localhost:3000>。其他玩家从你部署后的同一网站用房间码加入。

```bash
npm test           # 规则与HTTP/SSE集成测试
npm run build      # 源码语法与必要文件检查，无需打包前端
npm run dev        # 开发模式，服务器文件变化后重启
```

## GitHub → Render

1. 新建自己的 GitHub repository，把本目录的内容放在仓库根目录，包括 `package.json`、`package-lock.json`、`server.mjs`、`render.yaml`、`public/`、`src/`。
2. Render → **New → Web Service**，连接该 GitHub repository。
3. Runtime 选 **Node**；Root Directory 留空；Build Command 填 `npm ci && npm run build`；Start Command 填 `npm start`；Health Check Path 填 `/healthz`。
4. 点击部署。也可用仓库的 `render.yaml` 创建 Blueprint。

| 设置 | 值 |
| --- | --- |
| Runtime | Node |
| Node | 22 或 24 |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check | `/healthz` |
| Web Service 实例数 | **1** |
| `PORT` | Render 自动提供，不必手填 |

必须是 **Web Service**，因为房间状态由 Node 服务维护。静态站点无法运行联机服务器。前后端共用一个来源，不需要设置 CORS 或另外部署前端。`render.yaml` 默认 free 方案。

### 对局保存与免费实例

服务器默认把房间原子写入 `./room-data/`，刷新、断线后可重连；同一文件系统内的进程重启也可恢复。房间保存7天，超期清理。

Render 免费服务的文件系统不持久，休眠、重新部署或实例替换可能使房间丢失。下载的“重连凭据”只恢复玩家身份，不能恢复已经丢失的服务端房间。

需要跨部署保留对局时，在支持磁盘的付费单实例 Web Service 上添加 Persistent Disk：

| 项目 | 值 |
| --- | --- |
| Disk Mount Path | `/var/data` |
| Environment variable | `ROOM_DATA_DIR=/var/data/pandemic` |

不要运行多个实例：当前实现使用单进程房间管理和本地 JSON 持久化，没有跨实例广播或数据库锁。持久化目录含房间身份令牌，已加入 `.gitignore`，不要提交或公开分享。

官方部署资料：<https://render.com/docs/deploy-node-express-app>、<https://render.com/docs/free>、<https://render.com/docs/disks>。

## 开局与操作

- 创建房间，复制邀请链接或告诉伙伴6位房间码。
- 1名真人：房主添加自己的第2–4名角色，一个人依次操作。
- 2–4名真人：各自加入，默认各控制一名角色；总角色数2–4。
- 选择不重复的职业，或随机。开启挑战与难度后由房主开始。
- 右侧选择“操作角色”。行动阶段进行移动、治疗、共享知识、建站或研发；行动用完后仍须点击“结束行动”。可以提前结束。
- 抽牌、突变、疫情感染与强化、正常感染按按钮逐步推进。可在规则允许的间隙使用事件，不会自动跳过窗口。
- 治疗、移动等操作可点击地图指定城市。研发先点击自己的城市牌，再确认。
- 实验室中，治疗时选择采样皿；研究站内使用实验室菜单定性、处理、测试、测序；建站提供即时奖励。
- 操作另一玩家的角色、转移其手牌或换职业时，会请求其同意。待确认期间暂停其他命令，任何受影响玩家可拒绝，发起者可取消。
- 入门难度4张疫情：手牌公开。5–7张疫情：自己的手牌可见，其他玩家的手牌隐藏；共享知识时沟通具体城市牌。单人多角色可以看到自己控制的全部手牌。
- 原浏览器会保留重连身份；可下载重连凭据，在新浏览器首页导入。不同真人同机测试请用不同浏览器配置或无痕窗口。
- 右上角“规则速查”查看行动与职业说明，弃牌堆可随时查看。

## 实现范围

| 内容 | 范围 |
| --- | --- |
| 地图 | 48城市、93条双向连线，含3条跨边界连接 |
| 基础版 | 7职业、5事件、4种疾病、全部基础行动、疫情、连锁爆发、手牌上限、胜负 |
| 难度 | 4 / 5 / 6 / 7张疫情，分堆插入；不是全牌库随机混入 |
| Virulent Strain | 原8种效果；扩展卡开关再加入2种 In the Lab 效果 |
| Mutation | 12紫色方块、2感染突变牌、3玩家突变事件及特殊研发／胜利要求 |
| In the Lab | 14序列牌、5培养皿、2研究线、灰格／根除颜色规则、全部实验室行动及建站奖励 |
| Worldwide Panic | 可选24紫色方块变体，与强毒株／实验室叠加 |
| 扩展职业与事件 | 6个 Brink 职业、4个 Lab 职业、8+3个事件；排除Lab不允许的Field Operative |
| 联机 | 1–4真人、2–4角色、房间码、SSE实时同步、身份恢复、协作同意、状态版本校验 |

单人采用多角色合作。**不含** CDC单角色模式、第五位真人、生化恐怖分子、Team竞赛模式、自动玩家、实时聊天或观战。开局职业可指定；随机选角同样可用。

实现依据、序列卡组成和规则测试覆盖见 [docs/RULES.md](docs/RULES.md)。测试覆盖已列出的规则与交互，不代表每一种罕见事件组合都经过独立人工实盘认证。

## 文件结构

| 文件 | 用途 |
| --- | --- |
| `server.mjs` | HTTP、SSE、房间管理、身份、权限、协作确认、原子持久化 |
| `src/engine.js` | 可独立测试的规则状态转换；非法命令不改变原状态 |
| `src/data.js` | 48城市、人口、坐标与93条连线 |
| `src/catalog.js` | 职业、事件、强毒株与14张序列卡的数据 |
| `public/app.js` | 中文操作界面、SVG地图、实验室、手牌、重连 |
| `public/style.css` | 响应式样式 |
| `tests/engine.test.mjs` | 规则、组合模拟与方块守恒测试 |
| `tests/server.test.mjs` | 多人权限、协作同意、旧请求、SSE和重启恢复 |
| `render.yaml` | Render Blueprint |
| `Dockerfile` | 可选Docker运行 |

## 可选 Docker

```bash
docker build -t pandemic-command .
docker run --rm -p 3000:3000 pandemic-command
```

需要持久化时挂载一个对容器 `node` 用户可写的目录到 `/app/room-data`，或设置 `ROOM_DATA_DIR` 指向可写的挂载目录。

## 开发与规则API

`newGame(seats, options, rng?)` 创建对局；`apply(state, actorId, command, rng?)` 返回新状态，失败抛 `RuleError`；`invariants(state)` 检查各颜色的方块总量。服务器才持有牌库和未公开信息；`view(state, memberId)` 按玩家脱敏。

命令有 `move`、`treat`、`build`、`share`、`cure`、`lab`、`role`、`event`、`discard`、`advance`，以及 `bonusLab`、`sequenceChoice`、`forecastChoice`。前端是参数使用示例。HTTP写入必须携带房间 `version` 和属于操作角色所有者的 Bearer token；过时请求返回409。

源码未包含账号密码、托管令牌或已发布的网站地址。
