import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

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
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const membersResponse = await fetch(`${backendBase}/api/v1/group-members/member/${encodeURIComponent(groupId)}`, {
      method: 'GET',
      headers,
    });

    if (!membersResponse.ok) {
      const errorText = await membersResponse.text();
      return NextResponse.json(
        { error: '그룹 멤버 조회에 실패했습니다.', details: errorText },
        { status: membersResponse.status }
      );
    }

    const membersData = await membersResponse.json();
    const allLocations: any[] = [];

    for (const member of Array.isArray(membersData) ? membersData : []) {
      const memberLocationsResponse = await fetch(`${backendBase}/api/v1/locations/member/${member.mt_idx}`, {
        method: 'GET',
        headers,
      });

      if (!memberLocationsResponse.ok) {
        continue;
      }

      const memberLocations = await memberLocationsResponse.json();
      if (Array.isArray(memberLocations)) {
        const groupLocations = memberLocations.filter((location: any) => location.sgt_idx == groupId);
        allLocations.push(...groupLocations);
      }
    }

    const processedData = allLocations.map((location: any) => ({
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
      },
    });
  } catch (error) {
    console.error('[Group Locations API] 오류:', error);
    return NextResponse.json(
      { error: '그룹 장소 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
