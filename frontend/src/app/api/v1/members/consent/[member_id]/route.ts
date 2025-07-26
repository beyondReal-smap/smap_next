import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

// SSL 인증서 문제 해결을 위한 설정
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

async function fetchWithFallback(url: string, options: RequestInit = {}): Promise<any> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';
  
  console.log('[CONSENT API] 🔗 백엔드 요청:', {
    url,
    backendUrl,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CONSENT API] ❌ 백엔드 응답 오류:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url
      });
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[CONSENT API] ✅ 백엔드 응답 성공:', {
      url,
      dataType: typeof data,
      timestamp: new Date().toISOString()
    });

    return data;
  } catch (error) {
    console.error('[CONSENT API] 🚨 요청 실패:', {
      url,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ member_id: string }> }
) {
  const { member_id } = await params;
  try {
    console.log('[CONSENT API] 동의 정보 조회 요청:', member_id);
    console.log('[CONSENT API] NODE_ENV:', process.env.NODE_ENV);
    console.log('[CONSENT API] 환경 변수 BACKEND_URL:', process.env.BACKEND_URL);
    
    // JWT 토큰 검증
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;
    
    if (!token) {
      console.log('[CONSENT API] 토큰 없음');
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = verifyJWT(token);
    if (!decoded) {
      console.log('[CONSENT API] 토큰 검증 실패');
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const currentUserId = decoded.mt_idx;
    const requestedUserId = parseInt(member_id);

    // 본인 정보만 조회 가능
    if (currentUserId !== requestedUserId) {
      console.log('[CONSENT API] 권한 없음:', { currentUserId, requestedUserId });
      return NextResponse.json(
        { success: false, message: '본인의 동의 정보만 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 백엔드 API 호출 - 성공하는 API 패턴 사용
    const backendUrl = `https://118.67.130.71:8000/api/v1/members/consent/${requestedUserId}`;
    
    console.log('[CONSENT API] 사용된 백엔드 URL:', backendUrl);
    console.log('[CONSENT API] 전체 요청 URL:', backendUrl);
    
    const data = await fetchWithFallback(backendUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('[CONSENT API] 백엔드 응답 성공:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[CONSENT API] 서버 오류:', error);
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 