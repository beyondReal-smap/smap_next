import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';
import resolveBackendBaseUrl from '../../_utils/backend';

export async function GET(request: NextRequest) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('memberId');

  if (!memberId) {
    return NextResponse.json(
      { error: 'memberId parameter is required' },
      { status: 400 }
    );
  }

  try {
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/group-members/member/${encodeURIComponent(memberId)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Next.js API Proxy',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: '멤버 그룹 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const membersData = await response.json();
    return NextResponse.json(membersData, {
      headers: {
        'X-Data-Source': 'backend-real',
      },
    });
  } catch (error) {
    console.error('[Group Members API] 백엔드 호출 실패:', error);
    return NextResponse.json(
      { error: '멤버 그룹 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
