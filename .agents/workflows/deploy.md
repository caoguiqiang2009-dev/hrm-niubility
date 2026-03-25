# 一键部署到阿里云 Windows 服务器（GitHub 直拉版）

由于 Windows OpenSSH 对于主机密钥权限要求极其严苛，为了避免各种权限玄学问题，我们采用**在服务器端直接通过 GitHub 仓库部署**的黄金模式！

这也是目前最稳定直接的部署方案。

## 部署执行命令（复制完整大段）

请在 **Windows Server 的 PowerShell（管理员）** 中，直接粘贴运行以下**整段**命令：

```powershell
# 1. 创建工作目录并进入
mkdir -Force C:\hrm-niubility
cd C:\hrm-niubility

# 2. 从 GitHub 下载最新代码压缩包
Invoke-WebRequest -Uri "https://github.com/caoguiqiang2009-dev/hrm-niubility/archive/refs/heads/main.zip" -OutFile "main.zip"

# 3. 解压缩并整理
Expand-Archive -Path "main.zip" -DestinationPath "." -Force
Move-Item -Path ".\hrm-niubility-main\*" -Destination "." -Force
Copy-Item ".env.example" -Destination ".env"

# 4. 安装依赖并自动构建
npm install --loglevel error
npm run build:all

# 5. 确保 data 目录存在（避免因 Git 不跟踪空文件夹导致 SQLite 崩溃）
mkdir -Force data

# 6. 为系统下载注册 NSSM 环境（如果没有的话）
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "nssm.zip"
Expand-Archive -Path "nssm.zip" -DestinationPath "C:\" -Force
Rename-Item -Path "C:\nssm-2.24" -NewName "C:\nssm" -ErrorAction SilentlyContinue

# 7. 先杀掉僵尸进程（如果有），避免 3001 端口被占用
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Stop-Service HrmNiubility -ErrorAction SilentlyContinue
nssm remove HrmNiubility confirm

# 8. 安装和配置 NSSM 后台自启服务
C:\nssm\win64\nssm.exe install HrmNiubility "C:\Program Files\nodejs\node.exe" "C:\hrm-niubility\server-dist\index.js"
C:\nssm\win64\nssm.exe set HrmNiubility AppDirectory "C:\hrm-niubility"
C:\nssm\win64\nssm.exe set HrmNiubility AppEnvironmentExtra "NODE_ENV=production"

# 9. 开放 Windows 内部防火墙 3001 端口并启动！
New-NetFirewallRule -DisplayName "HRM" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
Start-Service HrmNiubility
```

## 注意事项

⚠️ **如果你用的是阿里云轻量应用服务器：**
Windows 内部防火墙还不够，必须去**阿里云网页控制台 -> 安全 -> 防火墙** 中添加规则，放行 TCP 协议的 `3001` 端口，才能被外部公网访问。

## GitHub 仓库

```bash
# 推送代码
git push origin main
```
