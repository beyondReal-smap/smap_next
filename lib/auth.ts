import { hash, compare } from 'bcryptjs';
import { pool } from './db';
import { User } from '../types/user';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// 이메일 전송 설정
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// 로그인 시도 횟수 관리를 위한 Map
const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

// 이메일 인증 코드 생성
export function generateVerificationCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// 이메일 인증 메일 발송
export async function sendVerificationEmail(email: string, code: string) {
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: '이메일 인증 코드',
    html: `
      <h1>이메일 인증 코드</h1>
      <p>아래의 인증 코드를 입력해주세요:</p>
      <h2>${code}</h2>
    `
  };

  await transporter.sendMail(mailOptions);
}

// 비밀번호 재설정 토큰 생성
export async function createPasswordResetToken(email: string) {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = await hash(resetToken, 12);
  
  await pool.execute(
    'UPDATE member_t SET mt_reset_token = ?, mt_token_edate = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE mt_email = ?',
    [hashedToken, email]
  );
  
  return resetToken;
}

// 비밀번호 재설정 메일 발송
export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password/${resetToken}`;
  
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: '비밀번호 재설정',
    html: `
      <h1>비밀번호 재설정</h1>
      <p>아래 링크를 클릭하여 비밀번호를 재설정하세요:</p>
      <a href="${resetUrl}">비밀번호 재설정하기</a>
      <p>이 링크는 1시간 동안만 유효합니다.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

// 로그인 시도 제한 체크
export function checkLoginAttempts(userId: string): boolean {
  const attempts = loginAttempts.get(userId);
  
  if (!attempts) {
    loginAttempts.set(userId, { count: 1, lastAttempt: new Date() });
    return true;
  }
  
  const timeDiff = new Date().getTime() - attempts.lastAttempt.getTime();
  
  // 24시간이 지나면 초기화
  if (timeDiff > 24 * 60 * 60 * 1000) {
    loginAttempts.set(userId, { count: 1, lastAttempt: new Date() });
    return true;
  }
  
  // 5회 이상 시도시 차단
  if (attempts.count >= 5) {
    return false;
  }
  
  attempts.count += 1;
  attempts.lastAttempt = new Date();
  loginAttempts.set(userId, attempts);
  
  return true;
}

// 자동 로그인 토큰 생성
export async function createAutoLoginToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = await hash(token, 12);
  
  await pool.execute(
    'UPDATE member_t SET mt_token_id = ?, mt_token_edate = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE mt_idx = ?',
    [hashedToken, userId]
  );
  
  return token;
}

// 자동 로그인 검증
export async function verifyAutoLoginToken(token: string) {
  try {
    const [rows]: any = await pool.execute(
      'SELECT * FROM member_t WHERE mt_token_id = ? AND mt_token_edate > NOW()',
      [token]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    throw new Error('Failed to verify auto login token');
  }
}