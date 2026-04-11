const crypto = require('crypto');
const { logger } = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    logger.warn('未设置 ENCRYPTION_KEY 环境变量，使用默认密钥（不安全）');
    return crypto.scryptSync('default-encryption-key', 'salt', 32);
  }
  return crypto.scryptSync(key, 'salt', 32);
}

function encrypt(text, key = null) {
  if (!text) return null;
  
  const encryptionKey = key || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const derivedKey = crypto.scryptSync(encryptionKey, salt, 32);
  
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  const result = salt.toString('hex') + iv.toString('hex') + authTag.toString('hex') + encrypted;
  
  return result;
}

function decrypt(encryptedData, key = null) {
  if (!encryptedData) return null;
  
  try {
    const encryptionKey = key || getEncryptionKey();
    
    const saltHex = encryptedData.slice(0, SALT_LENGTH * 2);
    const ivHex = encryptedData.slice(SALT_LENGTH * 2, SALT_LENGTH * 2 + IV_LENGTH * 2);
    const authTagHex = encryptedData.slice(SALT_LENGTH * 2 + IV_LENGTH * 2, SALT_LENGTH * 2 + IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);
    const encrypted = encryptedData.slice(SALT_LENGTH * 2 + IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2);
    
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const derivedKey = crypto.scryptSync(encryptionKey, salt, 32);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('解密失败', { error: error.message });
    return null;
  }
}

function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  
  return {
    hash,
    salt
  };
}

function verifyPassword(password, hash, salt) {
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateUUID() {
  return crypto.randomUUID();
}

function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function sha512(text) {
  return crypto.createHash('sha512').update(text).digest('hex');
}

function hmac(text, secret = process.env.HMAC_SECRET || 'default-hmac-secret') {
  return crypto.createHmac('sha256', secret).update(text).digest('hex');
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  
  const [localPart, domain] = email.split('@');
  const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.min(localPart.length - 2, 5)) + localPart.charAt(localPart.length - 1);
  
  return `${maskedLocal}@${domain}`;
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskIdCard(idCard) {
  if (!idCard || idCard.length < 8) return idCard;
  
  return idCard.slice(0, 4) + '*'.repeat(idCard.length - 8) + idCard.slice(-4);
}

function maskBankCard(cardNumber) {
  if (!cardNumber || cardNumber.length < 8) return cardNumber;
  
  return cardNumber.slice(0, 4) + ' **** **** ' + cardNumber.slice(-4);
}

const sensitiveFields = ['password', 'pwd', 'secret', 'token', 'apiKey', 'api_key', 'accessToken', 'access_token', 'refreshToken', 'refresh_token', 'creditCard', 'credit_card', 'idCard', 'id_card'];

function maskSensitiveData(data, fields = sensitiveFields) {
  if (!data || typeof data !== 'object') return data;
  
  const masked = Array.isArray(data) ? [] : {};
  
  for (const key in data) {
    if (fields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      masked[key] = '******';
    } else if (typeof data[key] === 'object' && data[key] !== null) {
      masked[key] = maskSensitiveData(data[key], fields);
    } else {
      masked[key] = data[key];
    }
  }
  
  return masked;
}

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateToken,
  generateUUID,
  md5,
  sha256,
  sha512,
  hmac,
  maskEmail,
  maskPhone,
  maskIdCard,
  maskBankCard,
  maskSensitiveData
};
