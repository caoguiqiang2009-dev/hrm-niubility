---
description: 在阿里云 Windows 轻量应用服务器上打通 SSH 远程连接
---

# 打通阿里云 Windows 服务器 SSH

适用于全新的阿里云轻量应用服务器（Windows Server 2019/2022）。

## 前置条件
- 服务器上已通过远程桌面（RDP）或网页终端打开了 **PowerShell（管理员）**
- 已知服务器公网 IP、Administrator 密码

---

## 第一步：安装 OpenSSH Server

> ⚠️ 不要使用 `Add-WindowsCapability`，轻量服务器大概率会报 `0x800f0954`（无法连接 Windows Update）。直接用 MSI 安装包！

```powershell
# 下载微软官方 OpenSSH MSI 安装包
Invoke-WebRequest -Uri "https://github.com/PowerShell/Win32-OpenSSH/releases/download/v9.5.0.0p1-Beta/OpenSSH-Win64-v9.5.0.0.msi" -OutFile "C:\Users\Administrator\OpenSSH-Win64.msi"

# 静默安装
msiexec /i "C:\Users\Administrator\OpenSSH-Win64.msi" /quiet

# 等待安装完成
Start-Sleep -Seconds 10
```

## 第二步：启动服务并设为开机自启

```powershell
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
```

## 第三步：开放 Windows 内部防火墙 22 端口

```powershell
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue
```

## 第四步：开放阿里云外部防火墙 22 端口（最容易遗漏！）

1. 登录 **阿里云控制台** → 找到这台轻量应用服务器
2. 左侧菜单 → **安全** → **防火墙**
3. 点击 **添加规则**：协议 `TCP`，端口 `22`，备注 `SSH`
4. 确认保存

## 第五步：从本地 Mac 测试连接

```bash
ssh -o StrictHostKeyChecking=no administrator@<服务器公网IP> "echo SSH_OK"
```

看到 `SSH_OK` 则表示 SSH 完全打通。

---

## 常见问题

### `Connection closed by x.x.x.x port 22`
- **最常见原因**：阿里云外部防火墙没有放行 22 端口（第四步）
- **次常见原因**：主机密钥权限问题（用 MSI 安装可避免）

### `Add-WindowsCapability` 报错 `0x800f0954`
- 这是因为轻量服务器无法连接 Windows Update 服务
- 解决方案：改用第一步中的 MSI 静默安装方式

### 之前安装过 OpenSSH 导致密钥权限混乱
如果之前通过 `Add-WindowsCapability` 安装过再卸载，残留的 `C:\ProgramData\ssh` 目录权限可能错乱。执行以下清理：
```powershell
Stop-Service sshd -ErrorAction SilentlyContinue
Remove-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 -ErrorAction SilentlyContinue
Remove-Item -Force -Recurse C:\ProgramData\ssh -ErrorAction SilentlyContinue
# 然后重新执行第一步的 MSI 安装
```
