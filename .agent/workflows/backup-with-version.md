---
description: 备份项目到 GitHub，自动带版本号 tag
---

# GitHub 备份流程（带版本号）

每次备份前需要先确定新版本号（语义化版本 `vMAJOR.MINOR.PATCH`）。

## 步骤

1. **更新 changelog** — 在 `src/data/changelog.ts` 最顶部插入新版本条目，填写 version/date/title/features/fixes

2. **更新 package.json 版本号**（同步，无 git tag）：
```
npm version <new_version> --no-git-tag-version
```

3. **暂存所有改动**：
```
git add -A
```

4. **提交，commit message 以版本号开头**：
```
git commit -m "release: v<new_version> - <简短描述>"
```

5. **创建 git tag**：
```
git tag v<new_version>
```

6. **推送代码 + tag**：
```
git push origin main && git push origin v<new_version>
```

## 版本号规则

| 类型 | 规则 | 举例 |
|---|---|---|
| PATCH | Bug 修复、小调整 | v1.2.0 → v1.2.1 |
| MINOR | 新功能、UI 重构 | v1.2.0 → v1.3.0 |
| MAJOR | 架构重大变更 | v1.2.0 → v2.0.0 |
