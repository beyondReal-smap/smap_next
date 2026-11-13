import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');
  const date = searchParams.get('date');

  try {
    if (!groupId || !date) {
      return NextResponse.json({ error: 'group_id and date parameters are required' }, { status: 400 });
    }

    const backendBase = process.env.BACKEND_URL || 'https://api3.aiagnt.kr';
    const backendUrl = `${backendBase}/api/v1/logs/members-with-logs?group_id=${groupId}&date=${date}`;

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
      console.error('[Members With Logs API] 백엔드 오류:', response.status, errorText);
      return NextResponse.json(
        { error: '로그가 있는 멤버 목록을 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { 'X-Data-Source': 'backend-direct' }
    });

  } catch (error) {
    console.error('[Members With Logs API] 오류:', error);
    return NextResponse.json(
      { error: '로그가 있는 멤버 목록 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}