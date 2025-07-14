# 🤖 MCP Manual Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

一個基於 Model Context Protocol (MCP) 的自動化截圖和使用手冊生成工具。支援任何 Web 應用程式，透過配置檔定義截圖流程，自動生成包含截圖的操作手冊。

## ✨ 特色功能

- 🖼️ **自動化截圖**：使用 Playwright 自動瀏覽網站並擷取畫面
- 🔐 **智能登入**：支援自動登入和身份驗證
- 📝 **手冊生成**：根據截圖自動生成 Markdown 格式的操作手冊
- 🎨 **模板系統**：支援自定義手冊模板
- 🔧 **高度可配置**：透過 JSON 配置檔控制所有行為
- 🤝 **MCP 整合**：可作為 MCP 服務器與 Claude 等 AI 助手整合
- 🌍 **環境變數**：支援敏感資訊的環境變數配置

## 🚀 快速開始

### 安裝

```bash
# 全域安裝
npm install -g mcp-manual-generator

# 或作為專案依賴
npm install mcp-manual-generator
```

### 基本使用

1. **初始化配置檔**
```bash
mcp-manual init
```

2. **編輯配置檔** (`mcp-manual.config.json`)
```json
{
  "project": {
    "name": "我的應用程式",
    "baseUrl": "http://localhost:3000"
  },
  "screenshots": [
    {
      "name": "home",
      "url": "/",
      "description": "首頁"
    }
  ]
}
```

3. **執行截圖和生成手冊**
```bash
mcp-manual run
```

## 📖 詳細文檔

### CLI 命令

#### `mcp-manual init`
初始化配置檔

```bash
mcp-manual init [options]

Options:
  -o, --output <path>  輸出路徑 (預設: ./mcp-manual.config.json)
```

#### `mcp-manual capture`
執行截圖

```bash
mcp-manual capture [options]

Options:
  -c, --config <path>   配置檔路徑 (預設: ./mcp-manual.config.json)
  -o, --output <dir>    截圖輸出目錄
  --headless           無頭模式執行
  --no-headless        顯示瀏覽器視窗
```

#### `mcp-manual generate`
生成操作手冊

```bash
mcp-manual generate [options]

Options:
  -s, --screenshots <dir>  截圖目錄 (預設: ./screenshots)
  -o, --output <path>      輸出檔案路徑 (預設: ./manual.md)
  -t, --template <name>    模板名稱或路徑 (預設: default)
  -m, --metadata <json>    額外的元數據 (JSON 字串)
```

#### `mcp-manual run`
執行完整流程（截圖 + 生成手冊）

```bash
mcp-manual run [options]

Options:
  -c, --config <path>  配置檔路徑
  --headless          無頭模式執行
```

#### `mcp-manual serve`
啟動 MCP 服務器

```bash
mcp-manual serve
```

### 配置檔說明

完整的配置檔範例：

```json
{
  "project": {
    "name": "應用程式名稱",
    "version": "1.0.0",
    "baseUrl": "http://localhost:3000",
    "description": "應用程式描述"
  },
  
  "auth": {
    "enabled": true,
    "credentials": {
      "username": "${TEST_USERNAME}",
      "password": "${TEST_PASSWORD}"
    },
    "loginUrl": "/login",
    "loginSelectors": {
      "username": "input[name='username']",
      "password": "input[name='password']",
      "submit": "button[type='submit']"
    }
  },
  
  "routing": {
    "mode": "hash"  // "hash" 或 "history"
  },
  
  "browser": {
    "headless": false,
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "timeout": 30000
  },
  
  "screenshots": [
    {
      "name": "login",
      "url": "/",
      "description": "登入頁面",
      "waitFor": "input",
      "folder": "01_login",
      "requireAuth": false
    },
    {
      "name": "dashboard",
      "url": "/#/dashboard",
      "description": "儀表板",
      "waitFor": ".dashboard",
      "folder": "02_main",
      "requireAuth": true
    }
  ],
  
  "manual": {
    "template": "default",
    "output": "./USER_MANUAL.md",
    "metadata": {
      "author": "作者名稱"
    }
  },
  
  "outputDir": "./screenshots",
  "delayBetweenScreenshots": 2000,
  "failOnError": false
}
```

### 環境變數

支援在配置檔中使用環境變數：

```bash
# .env 檔案
TEST_USERNAME=myuser
TEST_PASSWORD=mypassword
```

配置檔中使用 `${VARIABLE_NAME}` 格式引用。

## 🤝 MCP 整合

### 配置 MCP 服務器

在 Claude 或其他支援 MCP 的工具中配置：

```json
{
  "mcpServers": {
    "manual-generator": {
      "command": "mcp-manual",
      "args": ["serve"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### MCP 工具列表

- `capture_screenshots`: 根據配置擷取截圖
- `generate_manual`: 從截圖生成手冊
- `load_config`: 載入並驗證配置檔
- `capture_single`: 擷取單張截圖

## 🎨 自定義模板

建立自定義模板檔案：

```markdown
# {{projectName}} 使用手冊

版本：{{version}}
作者：{{author}}
日期：{{timestamp}}

## 目錄
{{toc}}

## 內容
{{sections}}
```

使用自定義模板：

```bash
mcp-manual generate -t ./my-template.md
```

## 📁 專案結構

執行後的輸出結構：

```
your-project/
├── mcp-manual.config.json    # 配置檔
├── screenshots/              # 截圖目錄
│   ├── 01_login/
│   │   └── login.png
│   ├── 02_main/
│   │   └── dashboard.png
│   └── screenshot_report.json
└── USER_MANUAL.md           # 生成的手冊
```

## 🛠️ 進階使用

### 程式化使用

```javascript
const { ScreenshotTool, ManualGenerator } = require('mcp-manual-generator');

async function generateManual() {
  // 截圖
  const screenshotTool = new ScreenshotTool({
    project: { baseUrl: 'http://localhost:3000' },
    screenshots: [
      { name: 'home', url: '/', description: '首頁' }
    ]
  });
  
  await screenshotTool.initialize();
  await screenshotTool.captureAll();
  await screenshotTool.cleanup();
  
  // 生成手冊
  const generator = new ManualGenerator({
    screenshotDir: './screenshots',
    outputPath: './manual.md'
  });
  
  await generator.generate();
}
```

### 整合到現有專案

1. 安裝依賴：
```bash
npm install mcp-manual-generator --save-dev
```

2. 加入 npm scripts：
```json
{
  "scripts": {
    "manual:init": "mcp-manual init",
    "manual:capture": "mcp-manual capture",
    "manual:generate": "mcp-manual generate",
    "manual:run": "mcp-manual run"
  }
}
```

3. 執行：
```bash
npm run manual:run
```

## 🐛 故障排除

### 常見問題

**Q: 截圖都是登入頁面？**  
A: 檢查路由模式設定是否正確（hash vs history）

**Q: 無法找到頁面元素？**  
A: 調整 `waitFor` 選擇器或增加 `waitTime`

**Q: 環境變數無法讀取？**  
A: 確保 `.env` 檔案在正確位置，或使用系統環境變數

### 調試模式

啟用詳細日誌：
```bash
LOG_LEVEL=debug mcp-manual capture
```

顯示瀏覽器視窗：
```bash
mcp-manual capture --no-headless
```

## 📄 授權

MIT License - 詳見 [LICENSE](LICENSE) 檔案

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📞 支援

- 📧 Email: haix.yeh@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/haixyeh/mcp-manual-generator/issues)

---

Made with ❤️ by Ryan Yeh