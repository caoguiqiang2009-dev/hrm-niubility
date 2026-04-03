---
description: 一键部署：更新版本号与说明 → 备份到 GitHub → 构建 → SCP 上传到 4001 测试服务器并重启
---

# /test-deploy 工作流

将本地最新代码同步到 4001 测试服务器，同时更新版本号、更新说明，并备份到 GitHub。

## 使用前提

- 本地代码已修改完毕，功能自测通过
- 已安装 `sshpass`（Mac：`brew install hudochenkov/sshpass/sshpass`）
- 服务器地址 `8.129.5.180`，服务名 `HrmNiubilityTest`

---

## 步骤

### 第 1 步：收集更新内容

询问用户（或根据 `git diff` 自动总结）本次更新的主要变更，包括：
- 新功能描述（中文简洁列表）
- Bug 修复说明
- 决定新版本号（规则：重大功能 minor+1，Bug修复 patch+1）

### 第 2 步：更新版本号

读取 `package.json` 中的当前版本，然后将 `version` 字段更新为新版本号。

```bash
# 查看当前版本
node -e "console.log(require('./package.json').version)"
```

用 `replace_file_content` 工具修改 `package.json` 中的 `"version"` 字段。

### 第 3 步：更新 DevRoleSwitcher 中的版本号

打开 `src/components/DevRoleSwitcher.tsx`，将顶部的 `APP_VERSION` 常量改为新版本号。

```ts
const APP_VERSION = 'vX.Y.Z';
```

### 第 4 步：提交并推送到 GitHub（打版本 tag）

// turbo
```bash
git add -A && git commit -m "release: vX.Y.Z - [本次更新一句话摘要]

[完整更新说明，多行]" && git push origin main && git tag vX.Y.Z && git push origin vX.Y.Z
```

### 第 5 步：本地构建

// turbo
```bash
npm run build:all 2>&1 | tail -8
```

如果构建失败，停止流程并报告错误。

### 第 6 步：SCP 上传到测试服务器

// turbo
```bash
sshpass -p 'yixi2026.' scp -o StrictHostKeyChecking=no -r dist/ server-dist/ administrator@8.129.5.180:C:/hrm-niubility-test/
```

等待上传完成（通常需要 1~2 分钟）。

### 第 7 步：重启服务并验证

// turbo
```bash
sshpass -p 'yixi2026.' ssh -o StrictHostKeyChecking=no administrator@8.129.5.180 "powershell -Command \"Restart-Service HrmNiubilityTest; Start-Sleep 3; (Invoke-WebRequest 'http://localhost:4001/api/health' -UseBasicParsing).Content\""
```

期望输出：`{"status":"ok","timestamp":"..."}` 

### 第 8 步：完成报告

告知用户：
- ✅ 当前版本：vX.Y.Z
- ✅ GitHub tag 已打：vX.Y.Z
- ✅ 4001 测试服务器已更新并通过健康检查
- 📋 本次更新说明摘要

---

## 注意事项

- **不得部署到正式生产环境**（正式端口 3001），除非用户明确要求
- 若上传失败（SCP 超时），使用 `expect scripts/run-test-deploy.sh` 备用方案（从 GitHub 拉取）
- 每次部署后，建议在浏览器打开 `http://8.129.5.180:4001` 点击右下角账号切换球确认版本号已更新
