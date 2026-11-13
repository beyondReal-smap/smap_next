import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';
import resolveBackendBaseUrl from '../../../_utils/backend';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { memberId } = await params;

  try {
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/member/${encodeURIComponent(memberId)}`;

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
        { error: '멤버 그룹 목록 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const groupsData = await response.json();
    return NextResponse.json(groupsData, {
      headers: {
        'X-Data-Source': 'backend-real',
        'X-Groups-Count': Array.isArray(groupsData) ? groupsData.length.toString() : '0',
      },
    });
  } catch (error) {
    console.error('[Member Groups API] 백엔드 호출 실패:', error);
    return NextResponse.json(
      { error: '멤버 그룹 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
