import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';
import resolveBackendBaseUrl from '@/app/api/_utils/backend';

export async function GET(request: NextRequest) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json(
      { success: false, message: '인증이 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const backendUrl = `${resolveBackendBaseUrl()}/api/v1/members/me`;
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { success: false, message: '인증이 유효하지 않습니다.' },
        { status: 401 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: '사용자 정보 조회에 실패했습니다.' },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const backendData = await response.json();
    const profile = backendData?.data || backendData;
    if (!backendData?.success || !profile?.mt_idx) {
      return NextResponse.json(
        { success: false, message: backendData?.message || '사용자 정보를 찾을 수 없습니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        mt_idx: profile.mt_idx,
        mt_id: profile.mt_id,
        mt_name: profile.mt_name,
        mt_nickname: profile.mt_nickname,
        mt_hp: profile.mt_hp,
        mt_email: profile.mt_email,
        mt_birth: profile.mt_birth,
        mt_gender: profile.mt_gender,
        mt_level: profile.mt_level,
        mt_type: profile.mt_type,
      },
      message: '사용자 정보 조회 성공',
    });
  } catch (error) {
    console.error('[USER INFO API] 오류:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, message: '인증 서버 연결에 실패했습니다.' },
      { status: 502 }
    );
  }
}
