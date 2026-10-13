# dsh-session-tools

> DeepSeek Harness（dsh）插件：在侧栏会话行「...」菜单里加一行 **「复制会话 ID」** —— 点一下就把 `session-xxxxxxxx-…` 复制到剪贴板。

会话 ID 在 dsh 里到处要用：指认一条会话、把它交给别的工具或 agent、在日志里对号入座 —— 但界面里并不好取。这个插件把"找到并复制"压成一次点击。

![菜单效果](./screenshot.png)

*（截图：会话「...」菜单里的「复制会话 ID」。）*

## 安装

### 方式一：从 GitHub 装（推荐）

在 dsh 的 profile（如 `~/.dsh/profiles/desktop/package.json`）里加依赖：

```jsonc
{ "dependencies": { "dsh-session-tools": "github:SongZcode/dsh-session-tools" } }
```

### 方式二：本地目录 + 链接（改代码时用）

```jsonc
{
  "dependencies": { "dsh-session-tools": "link:/path/to/dsh-session-tools" },
  "dsh": { "profile": { "bundles": ["…", "dsh-session-tools"] } }
}
```

装完**重启 dsh**（客户端半侧只在 web 启动时装载）。

## 行为

| 项 | 值 |
|---|---|
| 槽位 | `sidebar.workspaces.session.menu.item` |
| 该项 id | `dsh-session-tools-copy-id` |
| order | `350`（宿主自带项占 `100/200/300/400`，本项落在 `fork` 与 `archive` 之间） |
| 点击 | `navigator.clipboard.writeText(sessionId)` → 文案变「已复制 ✓」→ 1 秒后复原并关闭菜单 |
| 样式 | 与会话菜单其他项保持一致；跟随宿主的 dense / compact 变体 |
| 启动失败 | 只 warn，不阻断页面加载 |

## 配置

本插件没有配置项 —— 装了就生效，菜单里多一行。

## 卸载

1. 从 profile 的 `dependencies` 移除本包（本地链接方式还要删掉 `node_modules` 里的链接）→ 重启。
2. 想留包但关掉菜单项：从本包 `package.json` 删掉 `"dsh": { "client": … }` 与 `exports["./client"]` → 重启。

## 已知问题与排查

| 现象 | 原因 | 做法 |
|---|---|---|
| 菜单里没有这一项 | 客户端半侧没被加载（`exports["./client"]` 或 `dsh.client` 缺失/写错，宿主会静默跳过） | 检查本包 `package.json` 的两个字段，然后重启 dsh |
| 整包不生效、日志里说跳过 | bundle 没声明 `dsh.bundle` | 确认 `cordis.patch.yml` 存在且 `package.json` 里指向它 |
| 页面起不来 | 客户端脚本注册的 id 与包名不一致（撞上已注册的 factory） | 注册 id 必须是 npm 包名 |
| 菜单项位置不对 | order 与其他插件撞车 | 改 `client.js` 里的 `ORDER`（避开 100/200/300/400） |
| 改了没反应 | 插件目录同时被 HMR 监听，与 loader 叠加重复执行 | 别把插件目录加进 `hmr.root` |

## 兼容性

- dsh：**0.2.0-rc.2** 验证通过（`dsh.client.platform = "web"`）。
- 依赖的宿主面：会话菜单槽位 `sidebar.workspaces.session.menu.item`，其 ownerProps 为 `sessionId` / `displayTitle`。
  宿主大版本升级后若菜单项不再出现，多半是这个契约变了。

## 开发者：离线自检

```powershell
node tools/verify-client.mjs          # 期望 38/38
```

用一个假加载器 + 假 react + 假槽位服务把 `client.js` 真跑一遍，断言注册 id、槽位注入、order、
组件渲染、ownerProps 两种传参，以及**同 id 二次注册必须被吸收**（附一条反面对照）。
客户端半侧的错都发生在启动期，这条自检能在不重启 dsh 的前提下先把问题挡住。

## 许可

MIT
