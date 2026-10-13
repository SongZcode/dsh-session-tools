# 贡献指南

欢迎通过 Issue 或 Pull Request 提交问题、建议和改进。用户安装和使用说明见 [README](./README.md)。

## 本地开发

```sh
git clone https://github.com/SongZcode/dsh-session-tools.git
cd dsh-session-tools
node tools/verify-client.mjs
```

离线检查只依赖 Node.js 的内置模块，不需要先安装依赖。它验证客户端模块注册、菜单槽位、组件渲染和重复加载处理；它不替代真实 dsh 环境中的界面和剪贴板测试。

如需在 dsh 中调试，将测试 profile 的依赖指向本地仓库，并在 `dsh.profile.bundles` 中启用本包。使用该 profile 包管理器支持的本地目录依赖或链接方式，安装后重启 dsh。请勿将插件目录同时加入 `hmr.root`，避免 HMR 与插件加载器重复执行。

## 项目结构

| 文件 | 用途 |
| --- | --- |
| `client.js` | 注册菜单项、适配菜单样式并处理复制操作 |
| `index.js` | 宿主入口，供插件加载和生命周期管理使用 |
| `cordis.patch.yml` | 向 profile 加载器插入本包入口 |
| `package.json` | 包导出、dsh bundle 和客户端依赖声明 |
| `tools/verify-client.mjs` | 使用模拟加载器、React 和槽位服务进行离线检查 |

## 宿主接口

- 客户端模块注册 ID 与包名 `dsh-session-tools` 保持一致。
- `package.json` 需要同时声明 `dsh.bundle`、`dsh.client` 和 `exports["./client"]`。
- 会话菜单槽位为 `sidebar.workspaces.session.menu.item`。
- 菜单项 ID 为 `dsh-session-tools-copy-id`，排序值为 `350`。
- 槽位属性包括 `sessionId` 和 `displayTitle`；目前兼容对象和位置参数两种传递方式。
- 客户端模块重复注册时，插件会捕获 `duplicate factory registration` 错误并输出警告。

这些接口基于 dsh 0.2.0-rc.2。升级宿主或调整接口后，请检查真实环境中的兼容性。

## 验证

在仓库根目录运行：

```sh
node tools/verify-client.mjs
```

检查测试 profile 的安装配置时，可显式传入目录：

```sh
node tools/verify-client.mjs --profile /path/to/profile
```

如需同时核对 dsh 安装目录中的客户端依赖，将 `DSH_APP_MODULES` 环境变量设为该安装目录的 `node_modules` 路径。

提交涉及菜单行为的改动前，请在真实 dsh 环境中确认：

- 启动正常，菜单项只出现一次，样式与其他菜单项一致。
- 复制后粘贴出的 ID 属于选中的会话。
- 剪贴板接口不可用或权限拒绝时的行为。
- 停用插件并重启后，菜单项消失。

## 提交 Pull Request

说明解决的问题、用户可见的行为变化及验证结果。界面变化可附截图。请使用通用路径和示例数据，避免提交个人 profile、日志中的私密信息或机器专属配置。
