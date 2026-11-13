import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';
import { verifyBackendAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { user, token, errorResponse } = await verifyBackendAuth(request);
  if (errorResponse || !user || !token) {
    return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('_force_refresh') === 'true';
    const timestamp = searchParams.get('_t');
    const environment = process.env.NODE_ENV || 'development';

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/member/${user.mt_idx}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
        ...(forceRefresh && {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Force-Refresh': 'true',
          'X-Timestamp': timestamp || Date.now().toString(),
          'X-Environment': environment,
        }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: '현재 사용자 그룹 목록 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const groupsData = await response.json();
    return NextResponse.json(groupsData);
  } catch (error) {
    console.error('[Current User Groups API] 오류:', error);
    return NextResponse.json(
      { error: '현재 사용자 그룹 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
