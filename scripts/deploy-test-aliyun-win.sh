#!/bin/bash
# ============================================================================
# 🚀 阿里云 Windows 服务器一键部署脚本 (通用版)
# ============================================================================
# 适用于: macOS/Linux → 阿里云 Windows Server (通过 SSH + PowerShell)
# 服务管理: NSSM (Non-Sucking Service Manager)
#
# 使用方式:
#   1. 复制本脚本到项目的 scripts/ 目录
#   2. 在项目根目录创建 deploy-test.config 配置文件 (参考下方模板)
#   3. 运行: bash scripts/deploy-aliyun-win.sh
#
# 依赖: expect (macOS 自带), zip, scp, ssh
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/deploy-test.config"

# ─── 加载配置 ────────────────────────────────────────────────────────
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ 找不到配置文件: $CONFIG_FILE"
  echo ""
  echo "请在项目根目录创建 deploy-test.config，内容示例："
  echo ""
  echo '# 服务器连接'
  echo 'SERVER_IP="8.134.12.105"'
  echo 'SERVER_USER="administrator"'
  echo 'SERVER_PASS="your-password"'
  echo ''
  echo '# 远程路径'
  echo 'REMOTE_DIR="C:/my-app"'
  echo 'REMOTE_TEMP="C:/Users/Administrator"'
  echo ''
  echo '# 服务名称 (NSSM 注册的 Windows 服务名)'
  echo 'SERVICE_NAME="MyApp"'
  echo ''
  echo '# 端口 (用于最终提示访问地址)'
  echo 'APP_PORT="3000"'
  echo ''
  echo '# 构建命令'
  echo 'BUILD_CMD="npm run build"'
  echo ''
  echo '# 需要打包上传的文件/目录 (空格分隔)'
  echo 'DEPLOY_FILES="dist/ .env package.json package-lock.json"'
  echo ''
  echo '# 部署后执行的命令 (在远程服务器上, PowerShell 语法)'
  echo 'POST_DEPLOY_CMD="cd C:\\\\my-app; npm install --production 2>&1 | Select-Object -Last 3"'
  exit 1
fi

source "$CONFIG_FILE"

# ─── 校验必填配置 ────────────────────────────────────────────────────
REQUIRED_VARS=("SERVER_IP" "SERVER_USER" "SERVER_PASS" "REMOTE_DIR" "SERVICE_NAME" "DEPLOY_FILES")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ 配置项 $var 未设置，请检查 deploy-test.config"
    exit 1
  fi
done

# 设置默认值
APP_PORT="${APP_PORT:-3000}"
BUILD_CMD="${BUILD_CMD:-npm run build}"
REMOTE_TEMP="${REMOTE_TEMP:-C:/Users/Administrator}"
POST_DEPLOY_CMD="${POST_DEPLOY_CMD:-}"
DEPLOY_ZIP_NAME="${DEPLOY_ZIP_NAME:-deploy-package.zip}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 阿里云 Windows 一键部署"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  服务器: $SERVER_USER@$SERVER_IP"
echo "  远程目录: $REMOTE_DIR"
echo "  服务名: $SERVICE_NAME"
echo "  端口: $APP_PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── Step 1: 构建 ────────────────────────────────────────────────────
echo "🔨 [1/5] 构建生产包..."
cd "$PROJECT_DIR"
eval "$BUILD_CMD"
echo ""

# ─── Step 2: 打包 ────────────────────────────────────────────────────
echo "📦 [2/5] 打包部署文件..."
TEMP_ZIP="/tmp/$DEPLOY_ZIP_NAME"
rm -f "$TEMP_ZIP"
cd "$PROJECT_DIR"
# shellcheck disable=SC2086
zip -r "$TEMP_ZIP" $DEPLOY_FILES
echo ""

# ─── Step 3: 上传 ────────────────────────────────────────────────────
echo "📤 [3/5] 上传到服务器 ($SERVER_IP)..."
REMOTE_ZIP_PATH="$REMOTE_TEMP/$DEPLOY_ZIP_NAME"
expect -c "
set timeout 300
spawn scp -o StrictHostKeyChecking=no -o ServerAliveInterval=10 $TEMP_ZIP ${SERVER_USER}@${SERVER_IP}:${REMOTE_ZIP_PATH}
expect \"assword:\"
send \"${SERVER_PASS}\r\"
expect eof
"
echo ""

# ─── Step 4: 远程解压 + npm install + 重启服务 ───────────────────────
echo "🚀 [4/5] 服务器解压并重启服务..."

# 构建远程命令序列
REMOTE_COMMANDS="send \"powershell.exe\r\"
expect \">\"
"
# 解压
REMOTE_COMMANDS+="send \"Expand-Archive -Path ${REMOTE_ZIP_PATH} -DestinationPath ${REMOTE_DIR} -Force\r\"
expect \">\"
"
# 后置命令 (如 npm install)
if [ -n "$POST_DEPLOY_CMD" ]; then
  REMOTE_COMMANDS+="send \"${POST_DEPLOY_CMD}\r\"
expect -timeout 90 \">\"
"
fi
# 重启 NSSM 服务
REMOTE_COMMANDS+="send \"Restart-Service ${SERVICE_NAME}\r\"
expect \">\"
"
# 清理 zip
REMOTE_COMMANDS+="send \"Remove-Item ${REMOTE_ZIP_PATH} -Force\r\"
expect \">\"
"

expect -c "
set timeout 120
spawn ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=5 -o ServerAliveCountMax=30 ${SERVER_USER}@${SERVER_IP}
expect \"assword:\"
send \"${SERVER_PASS}\r\"
expect \">\"
${REMOTE_COMMANDS}
send \"exit\r\"
expect eof
"
echo ""

# ─── Step 5: 完成 ────────────────────────────────────────────────────
rm -f "$TEMP_ZIP"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ [5/5] 部署完成!"
echo "🌐 访问: http://${SERVER_IP}:${APP_PORT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
