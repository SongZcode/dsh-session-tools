# dsh-session-tools

为 DeepSeek Harness（dsh）添加 **「复制会话 ID」** 菜单项。在侧栏找到会话，打开「…」菜单，即可复制该会话的 ID，供其他工具使用或用于反馈问题。

![会话菜单中的「复制会话 ID」](./screenshot.png)

## 使用要求

- 已安装并能正常运行 dsh。本插件已在 **dsh 0.2.0-rc.2** 上验证，其他版本尚未验证。
- 适用于加载 dsh web 客户端的环境。
- 安装时需要 Git、Node.js 18 或更新版本，以及该 profile 使用的包管理器。

本项目是独立的社区插件。

## 安装

### 1. 找到当前使用的 profile

找到 dsh 当前使用的 profile 目录，并备份其中的 `package.json`。例如，desktop profile 可能位于 `~/.dsh/profiles/desktop/`；请以自己的实际配置为准。

### 2. 添加依赖并启用插件

编辑该 profile 的 `package.json`：

- 在 `dependencies` 中添加 `dsh-session-tools`。
- 在 `dsh.profile.bundles` 数组中添加 `dsh-session-tools`。

下面是需要合并的配置示例。**保留原有依赖、bundles 和其他字段，不要用示例覆盖整个文件。**

```json
{
  "dependencies": {
    "dsh-session-tools": "github:SongZcode/dsh-session-tools"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-session-tools"]
    }
  }
}
```

### 3. 安装依赖并重启

在 profile 目录中，使用该 profile 原有的包管理器安装依赖。例如，使用 npm 的 profile 执行：

```sh
npm install
```

如果原有项目使用 pnpm 或 Yarn，请使用对应的安装命令，避免混用锁文件。

完全退出并重新启动 dsh。打开任意会话的「…」菜单，确认出现 **「复制会话 ID」**。

## 使用

1. 在 dsh 侧栏找到要复制 ID 的会话。
2. 打开该会话的「…」菜单。
3. 点击「复制会话 ID」。
4. 将 ID 粘贴到需要的位置。复制的是类似 `session-…` 的会话标识，不是会话标题或聊天内容。

本插件无需额外配置。如果环境未提供剪贴板接口，插件会尝试显示手动复制对话框。

## 更新

在 profile 目录中，使用原有包管理器更新 `dsh-session-tools`，然后完全退出并重新启动 dsh。例如，npm 用户可以执行：

```sh
npm update dsh-session-tools
```

GitHub 依赖可能被锁文件固定在某次提交；更新后可检查锁文件中的提交是否发生变化。

## 卸载

1. 从 profile 的 `dsh.profile.bundles` 中移除 `dsh-session-tools`。
2. 从 `dependencies` 中移除 `dsh-session-tools`。
3. 在 profile 目录重新运行原有包管理器的安装命令，更新依赖和锁文件。
4. 完全退出并重新启动 dsh。

如果只是暂时停用，完成第 1 步并重启即可。

## 常见问题

### 安装后没有「复制会话 ID」

确认修改的是当前使用的 profile；检查依赖和 `dsh.profile.bundles` 是否都已添加本包，依赖安装是否成功，然后完全退出并重新启动 dsh。若仍未出现，请检查 dsh 版本是否为已验证版本。

### 点击后无法粘贴

剪贴板写入可能被浏览器权限或运行环境限制。先尝试在普通文本输入框中粘贴，并检查剪贴板权限。如果显示手动复制对话框，请从对话框中复制 ID。当前版本的「已复制」提示不能保证异步剪贴板写入成功。

### 提示「拿不到会话 ID」

重新打开目标会话的菜单再试。如果仍然出现，可能与当前 dsh 版本的兼容性有关，请提交问题反馈。

## 反馈与贡献

遇到问题或有功能建议，请到 [Issues](https://github.com/SongZcode/dsh-session-tools/issues) 反馈。请附上 dsh 版本、操作系统、安装方式、复现步骤，以及必要的截图或报错信息；发布前请隐藏私人会话内容和其他敏感信息。

欢迎提交 Pull Request。开发和验证方法见 [贡献指南](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
