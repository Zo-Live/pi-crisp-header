# Pi startup header

这个插件把 Pi 的启动头改成 Claude Code 风格：左侧显示 `pi.svg` 图标，右侧显示 Pi 版本和两行快捷键提示。

启动头外围使用 Codex 风格的圆角矩形边框，边框和右侧的 `pi` 文字会按照当前 thinking level 使用主题中的对应颜色；左侧图标保留 SVG 自带的颜色。输入框始终使用主题的 `dim` 灰色，与下方的当前目录、context 用量和模型信息一致。边框按内容宽度收紧，左右各留一格空白；终端较窄时自动截断内容，保持边框对齐。

它替换启动头并固定输入框边框颜色，不改变 Pi 的 `quietStartup` 行为。保持 `quietStartup: true` 时，资源列表、帮助提示和 tips 仍然隐藏，而插件提供的自定义 header 会正常显示。

## 安装

在此目录运行：

```bash
pi install ./pi-startup-header
```

之后重新启动 Pi 即可。如果只想临时试用：

```bash
pi --extension ./pi-startup-header/extensions/pi-startup-header.ts
```

图标颜色直接从 `assets/pi.svg` 读取；Windows Terminal 等不支持终端图片协议的环境使用同一 SVG 几何形状的彩色块渲染。
