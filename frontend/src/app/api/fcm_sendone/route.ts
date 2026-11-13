import { NextRequest, NextResponse } from 'next/server';
import { verifyBackendAdminAuth } from '@/lib/auth';

const BACKEND_HOST = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.aiagnt.kr';

async function postToBackend(url: string, body: unknown, token: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      'Cache-Control': 'no-store',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000)
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const { token, errorResponse } = await verifyBackendAdminAuth(request);
    if (errorResponse || !token) {
      return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const httpsUrl = `${BACKEND_HOST}/api/v1/fcm_sendone/`;
    const res = await postToBackend(httpsUrl, body, token);
    const data = await res.json().catch(() => ({ parseError: true }));

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[FCM API] ❌ 요청 처리 실패:', error);
    return NextResponse.json(
      {
        success: 'false',
        title: '푸시발송(단건) 실패',
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: null
      },
      { status: 500 }
    );
  }
}