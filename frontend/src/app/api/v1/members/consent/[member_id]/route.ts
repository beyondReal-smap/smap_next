import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

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

    // 백엔드 API 호출
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.BACKEND_URL || 'https://nextstep.smap.site')
      : (process.env.BACKEND_URL || 'https://118.67.130.71:8000');
    
    console.log('[CONSENT API] 사용된 백엔드 URL:', backendUrl);
    console.log('[CONSENT API] 전체 요청 URL:', `${backendUrl}/api/v1/members/consent/${requestedUserId}`);
    
    const response = await fetch(`${backendUrl}/api/v1/members/consent/${requestedUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[CONSENT API] 백엔드 응답 오류:', response.status, response.statusText);
      return NextResponse.json(
        { success: false, message: '동의 정보 조회에 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
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