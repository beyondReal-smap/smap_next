import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ member_id: string }> }
) {
  const { member_id } = await params;
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const currentUserId = user.mt_idx;
    const requestedUserId = parseInt(member_id, 10);

    // 본인 정보만 조회 가능
    if (currentUserId !== requestedUserId) {
      return NextResponse.json(
        { success: false, message: '본인의 동의 정보만 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 백엔드 API 호출
    const backendUrl = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
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