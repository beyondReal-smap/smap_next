import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';
import resolveBackendBaseUrl from '../../_utils/backend';

/**
 * 현재 로그인된 사용자의 정보 조회
 * GET /api/members/me
 */
export async function GET(request: NextRequest) {
  const { user, token, errorResponse } = await verifyBackendAuth(request);
  if (errorResponse || !user || !token) {
    return (
      errorResponse ??
      NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 })
    );
  }

  try {
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/members/${user.mt_idx}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, message: '사용자 정보 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const userData = await response.json();
    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('[Current User API] 오류:', error);
    return NextResponse.json(
      { success: false, message: '사용자 정보 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
