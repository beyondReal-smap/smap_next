import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';
import { extractAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = extractAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');
    const days = searchParams.get('days') || '14';

    if (!groupId) {
      return NextResponse.json(
        { error: 'group_id parameter is required' },
        { status: 400 }
      );
    }

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/logs/daily-counts?group_id=${groupId}&days=${days}`;

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
        { error: '일별 로그 카운트를 불러오는데 실패했습니다.' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[API] daily-counts 오류:', error);
    return NextResponse.json(
      { error: '일별 로그 카운트 조회 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}