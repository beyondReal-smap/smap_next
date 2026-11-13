import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }
  const { memberId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  try {
    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs/${memberId}/path?date=${date}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[Location Path API] 백엔드 오류:', response.status, errorText);
      return NextResponse.json(
        { error: '위치 경로를 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { 'X-Data-Source': 'backend-direct' }
    });

  } catch (error) {
    console.error('[Location Path API] 오류:', error);
    return NextResponse.json(
      { error: '위치 경로 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}