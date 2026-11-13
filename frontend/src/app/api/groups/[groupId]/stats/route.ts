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

  try {
    const { groupId } = await params;
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/groups/${encodeURIComponent(groupId)}/stats`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        success: true,
        data: data,
        message: '그룹 통계 조회 성공',
      });
    }

    return NextResponse.json(
      {
        success: false,
        data: null,
        message: '그룹 통계 데이터를 가져오는 데 실패했습니다.',
      },
      { status: response.status }
    );
  } catch (error) {
    console.error('[API] 그룹 통계 조회 오류:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: '그룹 통계 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
