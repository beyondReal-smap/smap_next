import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  const { groupId, memberId } = await params;

  try {
    const backendBase = resolveBackendBaseUrl();
    const locationsUrl = `${backendBase}/api/v1/locations/member/${encodeURIComponent(memberId)}`;

    const response = await fetch(locationsUrl, {
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
        { error: '멤버 장소 조회에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const locationsData = await response.json();
    const processedData = (Array.isArray(locationsData) ? locationsData : [])
      .filter((location: any) => location.sgt_idx == groupId)
      .map((location: any) => ({
        ...location,
        slt_show: location.slt_show || 'Y',
        slt_enter_chk: location.slt_enter_chk || 'N',
        slt_enter_alarm: location.slt_enter_alarm || 'Y',
        slt_wdate: location.slt_wdate || new Date().toISOString(),
        slt_udate: location.slt_udate || new Date().toISOString(),
        slt_ddate: location.slt_ddate || null,
      }));

    return NextResponse.json(processedData, {
      headers: {
        'X-Data-Source': 'backend-direct',
        'X-Locations-Count': processedData.length.toString(),
        'X-Group-Id': groupId,
        'X-Member-Id': memberId,
      },
    });
  } catch (error) {
    console.error('[Member Locations API] 오류:', error);
    return NextResponse.json(
      { error: '멤버 장소 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
