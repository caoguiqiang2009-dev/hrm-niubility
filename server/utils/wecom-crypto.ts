/**
 * 企业微信消息加解密工具
 * 文档: https://developer.work.weixin.qq.com/document/path/90930
 */
import crypto from 'crypto';
import { wecomConfig } from '../config/wecom';

// 从 EncodingAESKey 派生 AES 密钥
function getAesKey(): Buffer {
  return Buffer.from(wecomConfig.callbackAesKey + '=', 'base64');
}

// SHA1 签名验证
export function verifySignature(
  msgSignature: string,
  timestamp: string,
  nonce: string,
  encrypt: string
): boolean {
  const token = wecomConfig.callbackToken;
  const arr = [token, timestamp, nonce, encrypt].sort();
  const sha1 = crypto.createHash('sha1').update(arr.join('')).digest('hex');
  return sha1 === msgSignature;
}

// AES-256-CBC 解密
export function decryptMsg(encrypted: string): string {
  const aesKey = getAesKey();
  const iv = aesKey.subarray(0, 16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);

  let decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);

  // 去除 PKCS7 填充
  const pad = decrypted[decrypted.length - 1];
  decrypted = decrypted.subarray(0, decrypted.length - pad);

  // 前16字节是随机字符串，接下来4字节是消息长度（大端），后面是消息，最后是 CorpID
  const msgLen = decrypted.readUInt32BE(16);
  const msg = decrypted.subarray(20, 20 + msgLen).toString('utf8');

  return msg;
}

// AES-256-CBC 加密（用于回复）
export function encryptMsg(replyMsg: string): string {
  const aesKey = getAesKey();
  const iv = aesKey.subarray(0, 16);

  // 随机16字节 + 消息长度(4字节大端) + 消息 + CorpID
  const randomBytes = crypto.randomBytes(16);
  const msgBuf = Buffer.from(replyMsg, 'utf8');
  const corpIdBuf = Buffer.from(wecomConfig.corpId, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(msgBuf.length, 0);

  let plaintext = Buffer.concat([randomBytes, lenBuf, msgBuf, corpIdBuf]);

  // PKCS7 填充到 32 字节的倍数
  const blockSize = 32;
  const padLen = blockSize - (plaintext.length % blockSize);
  const padBuf = Buffer.alloc(padLen, padLen);
  plaintext = Buffer.concat([plaintext, padBuf]);

  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  cipher.setAutoPadding(false);

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return encrypted.toString('base64');
}

// 生成回复签名
export function generateSignature(
  timestamp: string,
  nonce: string,
  encrypt: string
): string {
  const token = wecomConfig.callbackToken;
  const arr = [token, timestamp, nonce, encrypt].sort();
  return crypto.createHash('sha1').update(arr.join('')).digest('hex');
}

// 解析 XML 字符串为简单对象
export function parseXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  // 也处理非 CDATA 的情况
  const regex2 = /<(\w+)>([^<]+)<\/\1>/g;
  while ((match = regex2.exec(xml)) !== null) {
    if (!result[match[1]]) {
      result[match[1]] = match[2];
    }
  }
  return result;
}
