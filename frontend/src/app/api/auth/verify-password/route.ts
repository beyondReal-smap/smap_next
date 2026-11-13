import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  const fetchOptions: RequestInit = {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      ...options.headers,
    },
    body: options.body,
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword } = body;

    // 기본 유효성 검사
    if (!currentPassword) {
      return NextResponse.json(
        { 
          success: false, 
          message: '현재 비밀번호를 입력해주세요.' 
        },
        { status: 400 }
      );
    }

    // Authorization 헤더 전달
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { 
          success: false, 
          message: '인증 토큰이 필요합니다.' 
        },
        { status: 401 }
      );
    }

    console.log('🔄 FastAPI 백엔드로 비밀번호 확인 요청 전달');

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    const backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/verify-password`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        currentPassword,
      }),
    });

    if (backendData.success || backendData.result === 'Y') {
      console.log('✅ FastAPI 백엔드 비밀번호 확인 성공');
      
      return NextResponse.json({
        success: true,
        message: backendData.message || '비밀번호가 확인되었습니다.'
      });
    } else {
      console.log('❌ FastAPI 백엔드 비밀번호 확인 실패:', backendData.message);
      
      return NextResponse.json(
        { 
          success: false, 
          message: backendData.message || '비밀번호 확인에 실패했습니다.' 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ 비밀번호 확인 API 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
      },
      { status: 500 }
    );
  }
} 