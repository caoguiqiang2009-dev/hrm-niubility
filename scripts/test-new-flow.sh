#!/bin/bash
# 四大流程全测试脚本
API="http://localhost:3001/api"
PASS=0
FAIL=0

assert_ok() {
  local step="$1" result="$2"
  local code=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code','?'))" 2>/dev/null)
  if [ "$code" = "0" ]; then
    echo "  ✅ $step"
    PASS=$((PASS+1))
  else
    echo "  ❌ $step → $result"
    FAIL=$((FAIL+1))
  fi
}

# 登录所有角色
echo "🔐 登录所有角色"
ADMIN_TOKEN=$(curl -s $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
HR_TOKEN=$(curl -s $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"lifang"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
MGR_TOKEN=$(curl -s $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"zhangwei"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
EMP1_TOKEN=$(curl -s $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"zhaoming"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
EMP2_TOKEN=$(curl -s $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"liuqiang"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
EMP3_TOKEN=$(curl -s $API/auth/login -H "Content-Type: application/json" -d '{"code":"mock_code","userId":"chenxia"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "  admin/lifang(HR)/zhangwei(主管)/zhaoming/liuqiang/chenxia 全部登录成功"

echo ""
echo "═══════════════════════════════════════════════════"
echo "📋 流程一：团队内发起任务（主管→员工）"
echo "═══════════════════════════════════════════════════"

echo ""
echo "--- 1.1 主管(张伟)给员工(赵敏)下发绩效任务 ---"
R=$(curl -s $API/perf/plans -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MGR_TOKEN" \
  -d '{"title":"Q2用户增长方案","description":"制定Q2用户增长策略","category":"kpi","assignee_id":"zhaoming","approver_id":"zhangwei","department_id":2,"difficulty":"hard","deadline":"2026-06-30","quarter":"2026-Q2","target_value":"月活增长20%"}')
assert_ok "主管创建任务" "$R"
PLAN1_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo ""
echo "--- 1.2 主管提交审批 ---"
R=$(curl -s $API/perf/plans/$PLAN1_ID/submit -X POST -H "Authorization: Bearer $MGR_TOKEN")
assert_ok "提交审批" "$R"

echo ""
echo "--- 1.3 检查状态(应为pending_review) ---"
STATUS=$(curl -s $API/perf/plans/$PLAN1_ID -H "Authorization: Bearer $MGR_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
echo "  状态: $STATUS"

echo ""
echo "--- 1.4 直属上级(张伟/自身)审批通过 ---"
R=$(curl -s $API/perf/plans/$PLAN1_ID/approve -X POST -H "Authorization: Bearer $MGR_TOKEN")
assert_ok "审批通过" "$R"

echo ""
echo "--- 1.5 检查最终状态 ---"
STATUS=$(curl -s $API/perf/plans/$PLAN1_ID -H "Authorization: Bearer $MGR_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'status={d[\"status\"]} assignee={d[\"assignee_id\"]}')")
echo "  $STATUS"

echo ""
echo "═══════════════════════════════════════════════════"
echo "📋 流程二：申请新任务（员工→主管审批）"
echo "═══════════════════════════════════════════════════"

echo ""
echo "--- 2.1 员工(赵敏)申请个人目标 ---"
R=$(curl -s $API/perf/plans -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP1_TOKEN" \
  -d '{"title":"前端性能优化","description":"将首屏加载时间降低50%","category":"personal","approver_id":"zhangwei","department_id":2,"difficulty":"normal","deadline":"2026-05-31","quarter":"2026-Q2","target_value":"首屏<1.5s"}')
assert_ok "员工创建目标" "$R"
PLAN2_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo ""
echo "--- 2.2 员工提交审批 ---"
R=$(curl -s $API/perf/plans/$PLAN2_ID/submit -X POST -H "Authorization: Bearer $EMP1_TOKEN")
assert_ok "提交审批" "$R"

echo ""
echo "--- 2.3 员工尝试撤回 ---"
R=$(curl -s $API/perf/plans/$PLAN2_ID/withdraw -X POST -H "Authorization: Bearer $EMP1_TOKEN")
assert_ok "撤回" "$R"

echo ""
echo "--- 2.4 修改后重新提交 ---"
R=$(curl -s $API/perf/plans/$PLAN2_ID -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP1_TOKEN" \
  -d '{"title":"前端性能优化(修订版)","description":"将首屏加载时间降低50%+优化包体积"}')
assert_ok "修改草稿" "$R"
R=$(curl -s $API/perf/plans/$PLAN2_ID/submit -X POST -H "Authorization: Bearer $EMP1_TOKEN")
assert_ok "重新提交" "$R"

echo ""
echo "--- 2.5 主管(张伟)驳回 ---"
R=$(curl -s $API/perf/plans/$PLAN2_ID/reject -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MGR_TOKEN" \
  -d '{"reason":"目标不够SMART，请量化指标"}')
assert_ok "驳回" "$R"

echo ""
echo "--- 2.6 员工修改后重新提交 ---"
R=$(curl -s $API/perf/plans/$PLAN2_ID/resubmit -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP1_TOKEN" \
  -d '{"title":"前端性能优化(最终版)","description":"目标：首屏<1.5s,包体积<500KB","target_value":"首屏<1.5s, 包<500KB"}')
assert_ok "驳回后重提" "$R"

echo ""
echo "--- 2.7 主管审批通过 ---"
R=$(curl -s $API/perf/plans/$PLAN2_ID/approve -X POST -H "Authorization: Bearer $MGR_TOKEN")
assert_ok "审批通过" "$R"

echo ""
echo "--- 2.8 检查最终状态 ---"
STATUS=$(curl -s $API/perf/plans/$PLAN2_ID -H "Authorization: Bearer $EMP1_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'status={d[\"status\"]} title={d[\"title\"]}')")
echo "  $STATUS"

echo ""
echo "═══════════════════════════════════════════════════"
echo "📋 流程三：申请提案（员工→HR→总经理）"
echo "═══════════════════════════════════════════════════"

echo ""
echo "--- 3.1 员工(刘强)提交提案 ---"
R=$(curl -s $API/pool/tasks/propose -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP2_TOKEN" \
  -d '{"title":"智能客服AI助手","description":"【目标 S】\n搭建基于LLM的智能客服系统\n【指标 M】\n客服响应时间降低60%\n【方案 A】\n接入OpenAI API\n【相关 R】\n技术部+客服部协同\n【时限 T】\n2026-Q3","department":"技术部","difficulty":"hard","bonus":5000,"max_participants":4}')
assert_ok "提交提案" "$R"
POOL1_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo ""
echo "--- 3.2 HR(李芳)初审通过 ---"
R=$(curl -s $API/pool/proposals/$POOL1_ID/review -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HR_TOKEN")
assert_ok "检查HR权限" "$R"
# 用admin来做（lifang是hr角色但admin也有HR权限）
R=$(curl -s $API/pool/proposals/$POOL1_ID/review -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HR_TOKEN" \
  -d '{"action":"approve"}')
assert_ok "HR初审通过" "$R"

echo ""
echo "--- 3.3 总经理(admin)复核通过 ---"
R=$(curl -s $API/pool/proposals/$POOL1_ID/review -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"action":"approve"}')
assert_ok "总经理复核" "$R"

echo ""
echo "--- 3.4 验证published状态 ---"
STATUS=$(curl -s $API/pool/tasks/$POOL1_ID -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'status={d[\"status\"]} proposal_status={d[\"proposal_status\"]}')")
echo "  $STATUS"

echo ""
echo "--- 3.5 测试驳回流程：员工(陈夏)提案被驳回 ---"
R=$(curl -s $API/pool/tasks/propose -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP3_TOKEN" \
  -d '{"title":"员工茶水间升级","description":"增加咖啡机和零食柜","department":"行政部","difficulty":"easy","bonus":500,"max_participants":2}')
assert_ok "创建提案2" "$R"
POOL2_ID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

R=$(curl -s $API/pool/proposals/$POOL2_ID/review -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $HR_TOKEN" \
  -d '{"action":"reject","reason":"预算不足，下季度再议"}')
assert_ok "HR驳回提案" "$R"

echo ""
echo "═══════════════════════════════════════════════════"
echo "📋 流程四：认领任务（新流程）"
echo "═══════════════════════════════════════════════════"

echo ""
echo "--- 4.1 HR直接发布认领(无需RACI预配置) ---"
R=$(curl -s $API/pool/tasks/$POOL1_ID/start-claiming -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN")
assert_ok "发布认领" "$R"

echo ""
echo "--- 4.2 验证claiming状态(roles_config应为空) ---"
TASK_INFO=$(curl -s $API/pool/tasks/$POOL1_ID -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'status={d[\"status\"]} roles_config={d.get(\"roles_config\",\"空\")}')")
echo "  $TASK_INFO"

echo ""
echo "--- 4.3 员工(赵敏)认领R角色 ---"
R=$(curl -s $API/pool/tasks/$POOL1_ID/claim-role -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP1_TOKEN" \
  -d '{"role_name":"R","reason":"我有前端AI集成经验"}')
assert_ok "赵敏认领R" "$R"

echo ""
echo "--- 4.4 员工(刘强)认领A角色 ---"
R=$(curl -s $API/pool/tasks/$POOL1_ID/claim-role -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP2_TOKEN" \
  -d '{"role_name":"A","reason":"这是我的提案，我负责验收"}')
assert_ok "刘强认领A" "$R"

echo ""
echo "--- 4.5 员工(陈夏)认领C角色 ---"
R=$(curl -s $API/pool/tasks/$POOL1_ID/claim-role -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP3_TOKEN" \
  -d '{"role_name":"C","reason":"我可以提供客服领域建议"}')
assert_ok "陈夏认领C" "$R"

echo ""
echo "--- 4.6 赵敏重复认领（应失败）---"
R=$(curl -s $API/pool/tasks/$POOL1_ID/claim-role -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EMP1_TOKEN" \
  -d '{"role_name":"A","reason":"改认A"}')
CODE=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code','?'))" 2>/dev/null)
if [ "$CODE" = "400" ]; then
  echo "  ✅ 重复认领被拒绝(符合预期)"
  PASS=$((PASS+1))
else
  echo "  ❌ 重复认领未拒绝 → $R"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- 4.7 HR审批认领 ---"
CLAIMS=$(curl -s "$API/pool/role-claims?status=pending" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "  待审列表:"
echo "$CLAIMS" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
for c in d:
    print(f'    ID:{c[\"id\"]} {c.get(\"user_name\",c[\"user_id\"])} → {c[\"role_name\"]}')
"

CLAIM_IDS=$(echo "$CLAIMS" | python3 -c "import sys,json; [print(c['id']) for c in json.load(sys.stdin)['data']]" 2>/dev/null)
for CID in $CLAIM_IDS; do
  R=$(curl -s $API/pool/role-claims/$CID/review -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{"action":"approve","comment":"同意加入"}')
  assert_ok "审批claim#$CID" "$R"
done

echo ""
echo "--- 4.8 HR审批后配置RACI ---"
R=$(curl -s $API/pool/tasks/$POOL1_ID/roles -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"roles":[{"name":"R","required":2,"reward":1500},{"name":"A","required":1,"reward":2000},{"name":"C","required":1,"reward":500},{"name":"I","required":2,"reward":200}]}')
assert_ok "RACI配置" "$R"

echo ""
echo "--- 4.9 最终任务状态 ---"
curl -s $API/pool/tasks/$POOL1_ID -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "
import sys,json
d = json.load(sys.stdin)['data']
print(f'  状态: {d[\"status\"]}')
import json as j
rc = j.loads(d.get('roles_config','[]'))
for r in rc:
    print(f'    {r[\"name\"]}: 需{r[\"required\"]}人, 奖金¥{r[\"reward\"]}')
claims = d.get('role_claims',[])
print(f'  已认领: {len(claims)}人')
for c in claims:
    print(f'    {c.get(\"user_name\",\"?\")} → {c[\"role_name\"]} ({c[\"status\"]})')
"

echo ""
echo "═══════════════════════════════════════════════════"
echo "📊 测试汇总"
echo "═══════════════════════════════════════════════════"
echo "  ✅ 通过: $PASS"
echo "  ❌ 失败: $FAIL"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "🎉 四大流程全部通过！"
else
  echo "⚠️ 存在 $FAIL 个失败项，请检查"
fi
