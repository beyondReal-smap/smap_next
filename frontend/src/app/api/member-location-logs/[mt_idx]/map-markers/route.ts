import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ mt_idx: string }> }
) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ result: 'N', error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const params = await context.params;
    const { mt_idx } = params;
    const date = searchParams.get('date');
    const minSpeed = searchParams.get('min_speed') || '1.0';
    const maxAccuracy = searchParams.get('max_accuracy') || '50.0';

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required' },
        { status: 400 }
      );
    }

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs/${mt_idx}/map-markers?date=${date}&min_speed=${minSpeed}&max_accuracy=${maxAccuracy}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[API] 백엔드 응답 오류:', { status: response.status, errorText });
      return NextResponse.json(
        { result: 'N', error: '지도 마커를 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[API] map-markers 오류:', error);
    return NextResponse.json(
      { result: 'N', error: '지도 마커를 불러오는 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}