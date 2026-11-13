import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('[CONSENT API] 동의 상태 변경 요청');

    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { field, value } = body;

    // 백엔드 API 호출
    const backendUrl = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const response = await fetch(`${backendUrl}/api/v1/members/consent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, value }),
    });

    if (!response.ok) {
      console.error('[CONSENT API] 백엔드 응답 오류:', response.status, response.statusText);
      return NextResponse.json(
        { success: false, message: '동의 상태 변경에 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[CONSENT API] 백엔드 응답 성공');
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[CONSENT API] 서버 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 