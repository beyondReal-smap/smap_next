import type { NextApiRequest, NextApiResponse } from 'next';

// 백엔드 API URL (docker-compose.prod.yml의 nextjs 서비스 환경변수에서 가져오거나, next.config.js의 rewrites를 사용)
const BACKEND_API_URL = process.env.INTERNAL_BACKEND_URL || 'http://backend:5000'; // Docker 내부 통신용

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { email, password, name, phoneNumber } = req.body;

  if (!email || !password || !name || !phoneNumber) {
    return res.status(400).json({ message: '모든 필수 정보를 입력해주세요.' });
  }

  try {
    // FastAPI 백엔드의 /api/v1/auth/register 호출 (이 엔드포인트는 추후 FastAPI에 구현 필요)
    const backendRegisterResponse = await fetch(`${BACKEND_API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mt_id: phoneNumber, // FastAPI의 RegisterRequest 스키마에 맞출 필드명 (예: mt_id)
        mt_pwd: password,
        mt_name: name,
        mt_email: email,
        mt_hp: phoneNumber // 필요하다면 별도 연락처 필드
        // FastAPI 스키마에 따라 필요한 다른 정보도 전달 (예: mt_type, mt_level 등)
      }),
    });

    const backendRegisterData = await backendRegisterResponse.json();

    if (!backendRegisterResponse.ok) {
      // 백엔드에서 전달된 오류 메시지를 사용하거나, 기본 메시지 사용
      throw new Error(backendRegisterData.detail || backendRegisterData.message || '회원가입에 실패했습니다.');
    }

    // 회원가입 성공 응답 (백엔드에서 받은 데이터 전달 또는 커스텀 메시지)
    res.status(201).json({ 
      message: backendRegisterData.message || '회원가입이 성공적으로 완료되었습니다.', 
      user: backendRegisterData.user // 백엔드가 사용자 정보를 반환한다면 포함
    });

  } catch (error: any) {
    console.error('Frontend Register User API error:', error.message);
    res.status(error.status || error.response?.status || 500).json({ message: error.message || '서버 오류가 발생했습니다.' });
  }
} 