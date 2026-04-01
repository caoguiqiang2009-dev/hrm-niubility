---
description: 部署测试环境到阿里云服务器（端口 4001，独立数据库）
---

# 部署测试环境到阿里云 Windows 服务器

在同一台服务器 `8.129.5.180` 上，用不同端口和独立数据库运行测试版本。

## 环境对比

| 维度 | 生产环境 | 测试环境 |
|------|----------|----------|
| 目录 | `C:\hrm-niubility` | `C:\hrm-niubility-test` |
| 端口 | 3001 | 4001 |
| 数据库 | `data\hrm.db` | `data\hrm.db`（独立副本） |
| 服务名 | HrmNiubility | HrmNiubilityTest |
| Git 分支 | main | test（或 main） |
| 访问地址 | `http://8.129.5.180:3001` | `http://8.129.5.180:4001` |

## 首次部署（在 Windows Server PowerShell 管理员中执行）

```powershell
# ──────── 1. 下载代码到测试目录 ────────
mkdir -Force C:\hrm-niubility-test
cd C:\hrm-niubility-test

# 下载 main 分支（或改为 test 分支 URL）
Invoke-WebRequest -Uri "https://github.com/caoguiqiang2009-dev/hrm-niubility/archive/refs/heads/main.zip" -OutFile "main.zip"
Expand-Archive -Path "main.zip" -DestinationPath "." -Force
Move-Item -Path ".\hrm-niubility-main\*" -Destination "." -Force

# ──────── 2. 创建测试环境配置 ────────
Copy-Item ".env.example" -Destination ".env" -Force

# 修改端口为 4001
(Get-Content .env) -replace 'SERVER_PORT=3001', 'SERVER_PORT=4001' | Set-Content .env
# 追加测试标识
Add-Content .env "`nNODE_ENV=production"
Add-Content .env "APP_ENV=test"

# ──────── 3. 安装和构建 ────────
mkdir -Force data
npm install --loglevel error
npm run build:all

# ──────── 4. 注册 Windows 服务 ────────
Stop-Service HrmNiubilityTest -ErrorAction SilentlyContinue
C:\nssm\win64\nssm.exe remove HrmNiubilityTest confirm 2>$null

C:\nssm\win64\nssm.exe install HrmNiubilityTest "C:\Program Files\nodejs\node.exe" "C:\hrm-niubility-test\server-dist\index.js"
C:\nssm\win64\nssm.exe set HrmNiubilityTest AppDirectory "C:\hrm-niubility-test"
C:\nssm\win64\nssm.exe set HrmNiubilityTest AppEnvironmentExtra "NODE_ENV=production" "SERVER_PORT=4001"

# ──────── 5. 放行防火墙端口 ────────
New-NetFirewallRule -DisplayName "HRM-Test" -Direction Inbound -LocalPort 4001 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue

# ──────── 6. 启动！────────
Start-Service HrmNiubilityTest

# 验证
Start-Sleep -Seconds 3
Invoke-WebRequest -Uri "http://localhost:4001/api/health" -UseBasicParsing | Select-Object StatusCode, Content
```

⚠️ **阿里云轻量服务器还需要在 [控制台 → 安全 → 防火墙] 放行 TCP 4001 端口！**

## 增量更新测试环境

```powershell
cd C:\hrm-niubility-test

# 拉取最新代码
Invoke-WebRequest -Uri "https://github.com/caoguiqiang2009-dev/hrm-niubility/archive/refs/heads/main.zip" -OutFile "main.zip"
Expand-Archive -Path "main.zip" -DestinationPath ".\temp" -Force

# 只覆盖源码，不覆盖 data/ 和 .env
Copy-Item ".\temp\hrm-niubility-main\server\*" -Destination ".\server\" -Recurse -Force
Copy-Item ".\temp\hrm-niubility-main\src\*" -Destination ".\src\" -Recurse -Force
Copy-Item ".\temp\hrm-niubility-main\package.json" -Destination "." -Force
Remove-Item ".\temp" -Recurse -Force

# 重新构建和重启
npm install --loglevel error
npm run build:all
Restart-Service HrmNiubilityTest
```

## 同步生产数据到测试环境（可选）

在测试服务器上运行，将生产库的组织架构复制到测试库：

```powershell
cd C:\hrm-niubility-test
node scripts/sync-prod-data.mjs
Restart-Service HrmNiubilityTest
```

## 方式二：完全物理克隆（推荐，包含所有流水和绩效数据）

将主程序的数据库文件（包含 WAL 缓存文件）一比一覆盖到测试目录。

```powershell
Stop-Service HrmNiubilityTest
Copy-Item C:\hrm-niubility\data\hrm.db* -Destination C:\hrm-niubility-test\data\ -Force
Start-Service HrmNiubilityTest
```

## 关闭测试环境

```powershell
Stop-Service HrmNiubilityTest
C:\nssm\win64\nssm.exe remove HrmNiubilityTest confirm
Remove-NetFirewallRule -DisplayName "HRM-Test" -ErrorAction SilentlyContinue
```
