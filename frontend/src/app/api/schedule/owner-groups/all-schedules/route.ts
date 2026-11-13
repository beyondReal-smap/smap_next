import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAuth } from '@/lib/auth';
import resolveBackendBaseUrl from '../../../_utils/backend';

export async function GET(request: NextRequest) {
  try {
    const { user, token, errorResponse } = await verifyBackendAuth(request);
    if (errorResponse || !user || !token) {
      return errorResponse ?? NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const currentUserId = user.mt_idx.toString();

    const days = searchParams.get('days') || '7';
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const backendParams = new URLSearchParams({
      current_user_id: currentUserId,
      days: days,
    });
    if (year) backendParams.append('year', year);
    if (month) backendParams.append('month', month);

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/schedule/owner-groups/all-schedules?${backendParams.toString()}`;

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
        { success: false, message: '백엔드 요청에 실패했습니다.', error: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API PROXY] 최종 에러:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        message: 'API Proxy Error',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
