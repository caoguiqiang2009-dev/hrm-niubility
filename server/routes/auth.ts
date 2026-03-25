import { Router } from 'express';
import { getDb } from '../config/database';
import { generateToken, AuthRequest, authMiddleware } from '../middleware/auth';
import { getUserIdByCode } from '../services/wecom';

const router = Router();

// 获取企微 OAuth 跳转链接
router.get('/wecom-url', (req, res) => {
  // 动态获取当前访问的域名（如 nb.szyixikeji.com），支持 Nginx 等反代传过来的原始 Host
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const redirectUri = encodeURIComponent(`${protocol}://${host}/`); 
  
  const appid = process.env.WECOM_CORP_ID || 'CORPID_MISSING';
  const agentid = process.env.WECOM_AGENT_ID || 'AGENTID_MISSING';
  const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appid}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=HRM_LOGIN&agentid=${agentid}#wechat_redirect`;
  res.redirect(url);
});

// 企微 OAuth 登录
router.post('/login', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ code: 400, message: '缺少 code 参数' });
  }

  try {
    // 开发模式: 支持 mock 登录
    let userId: string;
    if (code === 'mock_code' || process.env.NODE_ENV === 'development') {
      userId = req.body.userId || 'zhangwei';
    } else {
      const result = await getUserIdByCode(code);
      userId = result.userId;
    }

    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在，请先同步组织架构' });
    }

    const token = generateToken(user.id, user.role);
    return res.json({
      code: 0,
      data: {
        token,
        user: { id: user.id, name: user.name, title: user.title, avatar_url: user.avatar_url, role: user.role, department_id: user.department_id },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ code: 500, message: error.message });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, title, department_id, avatar_url, mobile, email, role, status FROM users WHERE id = ?').get(req.userId);

  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }

  return res.json({ code: 0, data: user });
});

export default router;
