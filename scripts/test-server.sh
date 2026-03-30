#!/bin/bash
# ============================================================================
# 🔍 生产服务器 API 全面检测脚本
# ============================================================================
set -o pipefail
API="http://8.129.5.180:3001/api"
PASS=0; FAIL=0; WARN=0

test_api() {
  local method="$1" path="$2" label="$3" token="$4" body="$5"
  local args=("-s" "--connect-timeout" "10" "-m" "15" "-X" "$method")
  [ -n "$token" ] && args+=("-H" "Authorization: Bearer $token")
  [ -n "$body" ] && args+=("-H" "Content-Type: application/json" "-d" "$body")
  
  local result
  result=$(curl "${args[@]}" "$API$path" 2>&1)
  
  if [ $? -ne 0 ]; then
    echo "  ❌ $label — 连接失败"
    FAIL=$((FAIL+1)); return 1
  fi
  
  local code=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code','?'))" 2>/dev/null)
  local detail=$(echo "$result" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data',None)
if isinstance(d,list): print(f'{len(d)}条')
elif isinstance(d,dict) and 'id' in d: print(f'id={d[\"id\"]}')
elif isinstance(d,dict): print(f'{len(d)}字段')
elif d is not None: print(str(d)[:30])
else: print('OK')
" 2>/dev/null || echo "?")
  
  if [ "$code" = "0" ]; then
    echo "  ✅ $label ($detail)"
    PASS=$((PASS+1))
  else
    local msg=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','')[:60])" 2>/dev/null)
    [ -z "$msg" ] && msg=$(echo "$result" | head -c 60)
    echo "  ⚠️  $label — [$code] $msg"
    WARN=$((WARN+1))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 生产服务器 API 健康检查"
echo "   目标: $API"
echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🔐 登录..."
LOGIN_RES=$(curl -s --connect-timeout 10 $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"CaoGuiQiang"}')
TOKEN=$(echo "$LOGIN_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "  ✅ 登录成功: 曹贵强 (admin)"
PASS=$((PASS+1))

echo ""
echo "═══ 1. 基础认证 ═══"
test_api GET "/auth/me" "当前用户" "$TOKEN"

echo ""
echo "═══ 2. 用户 & 组织 ═══"
test_api GET "/users" "用户列表" "$TOKEN"
test_api GET "/departments" "部门列表" "$TOKEN"
test_api GET "/org/tree" "组织架构树" "$TOKEN"

echo ""
echo "═══ 3. 待办任务 ═══"
test_api GET "/tasks" "任务列表" "$TOKEN"
test_api POST "/tasks" "创建任务" "$TOKEN" '{"title":"[自动检测]测试任务","priority":"low"}'

echo ""
echo "═══ 4. 绩效管理 ═══"
test_api GET "/perf/plans" "绩效计划" "$TOKEN"
test_api GET "/perf/my-approvals" "我的审批" "$TOKEN"
test_api GET "/perf/history" "审批历史" "$TOKEN"
test_api GET "/perf/team-status" "团队状态" "$TOKEN"

echo ""
echo "═══ 5. 赏金榜 ═══"
test_api GET "/pool/tasks" "任务列表" "$TOKEN"
test_api GET "/pool/leaderboard" "排行榜" "$TOKEN"
test_api GET "/pool/role-claims?status=pending" "待审认领" "$TOKEN"

echo ""
echo "═══ 6. 工作流 ═══"
test_api GET "/workflows/initiated" "我发起的" "$TOKEN"
test_api GET "/workflows/pending" "待我审核" "$TOKEN"
test_api GET "/workflows/reviewed" "我已审核" "$TOKEN"
test_api GET "/workflows/cc" "抄送我的" "$TOKEN"

echo ""
echo "═══ 7. 通知 ═══"
test_api GET "/notifications" "通知列表" "$TOKEN"
test_api GET "/notifications/unread-count" "未读数" "$TOKEN"

echo ""
echo "═══ 8. 胜任力测评 ═══"
test_api GET "/competency/library" "能力项库" "$TOKEN"
test_api GET "/competency/models" "胜任力模型" "$TOKEN"
test_api GET "/competency/evaluations" "评估列表" "$TOKEN"

echo ""
echo "═══ 9. 题库测评 ═══"
test_api GET "/tests/bank" "题库列表" "$TOKEN"
test_api GET "/tests/my" "我的测试" "$TOKEN"

echo ""
echo "═══ 10. 薪酬 ═══"
test_api GET "/payroll/payslips" "工资条" "$TOKEN"
test_api GET "/payroll/config" "薪酬配置" "$TOKEN"

echo ""
echo "═══ 11. 数据统计 ═══"
test_api GET "/perf-stats/overview" "绩效总览" "$TOKEN"
test_api GET "/perf-stats/departments" "部门统计" "$TOKEN"

echo ""
echo "═══ 12. 系统设置 ═══"
test_api GET "/settings" "用户设置" "$TOKEN"
test_api GET "/permissions" "权限列表" "$TOKEN"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 检测汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 正常: $PASS"
echo "  ⚠️  警告: $WARN"
echo "  ❌ 失败: $FAIL"
TOTAL=$((PASS+WARN+FAIL))
echo "  📈 总计: $TOTAL 项"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "🎉 服务器所有核心 API 正常运行！"
else
  echo "⚠️ 存在 $FAIL 个失败项"
fi
echo ""
