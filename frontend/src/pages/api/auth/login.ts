import type { NextApiRequest, NextApiResponse } from 'next';
import cookie from 'cookie';

// DB 관련 임포트 제거
// import mysql from 'mysql2/promise';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken'; // JWT 생성은 백엔드에서 하므로 여기서는 필요 없음 (쿠키 설정용 토큰만 받음)

// 백엔드 API URL (docker-compose.prod.yml의 nextjs 서비스 환경변수에서 가져오거나, next.config.js의 rewrites를 사용)
// 컨테이너 내부에서 직접 호출 시:
const BACKEND_API_URL = process.env.INTERNAL_BACKEND_URL || 'http://backend:5000'; // Docker 내부 통신용

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { mt_hp, mt_pass } = req.body;

  if (!mt_hp || !mt_pass) {
    return res.status(400).json({ message: '전화번호와 비밀번호를 모두 입력해주세요.' });
  }

  try {
    // FastAPI 백엔드의 /api/v1/auth/login 호출
    const backendLoginResponse = await fetch(`${BACKEND_API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        mt_hp: mt_hp, // 하이픈 제거 등은 백엔드에서 처리하거나, 여기서도 가능
        mt_pass: mt_pass 
      }),
    });

    const backendLoginData = await backendLoginResponse.json();

    if (!backendLoginResponse.ok) {
      // 백엔드에서 전달된 오류 메시지를 사용하거나, 기본 메시지 사용
      throw new Error(backendLoginData.detail || backendLoginData.message || '로그인에 실패했습니다.');
    }

    // 백엔드에서 받은 access_token과 사용자 정보
    const { access_token, user } = backendLoginData;

    if (!access_token || !user) {
        throw new Error('백엔드 응답에 토큰 또는 사용자 정보가 없습니다.');
    }

    // JWT를 HTTP-only 쿠키에 설정 (기존 로직과 유사)
    res.setHeader(
      'Set-Cookie',
      cookie.serialize('smap_auth_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 1, // 1 day (백엔드 토큰 만료 시간과 동기화 필요)
        path: '/',
      })
    );

    // 로그인 성공 응답 (백엔드에서 받은 사용자 정보 전달)
    res.status(200).json({
      message: '로그인 성공',
      user: user, // 백엔드에서 받은 사용자 객체
    });

  } catch (error: any) {
    console.error('Frontend Login API error:', error.message);
    // error.response?.data?.detail 와 같이 백엔드 에러를 좀 더 자세히 로깅/반환 가능
    res.status(error.status || 500).json({ message: error.message || '서버 오류가 발생했습니다.' });
  }
} 