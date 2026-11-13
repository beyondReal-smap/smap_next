import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';
import resolveBackendBaseUrl from '../../../_utils/backend';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { groupId } = await params;

  try {
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/group-members/member/${encodeURIComponent(groupId)}`;

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
        { error: '그룹 멤버 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const membersData = await response.json();
    return NextResponse.json(membersData, {
      headers: {
        'X-Data-Source': 'backend-real',
        'X-Members-Count': Array.isArray(membersData) ? membersData.length.toString() : '0',
      },
    });
  } catch (error) {
    console.error('[Group Members API] 백엔드 호출 실패:', error);
    return NextResponse.json(
      { error: '그룹 멤버 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
