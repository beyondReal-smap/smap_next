import { NextRequest, NextResponse } from 'next/server';

const BACKEND_HOST = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.smap.site';

async function postToBackend(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000)
  });
  return response;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[FCM API] 푸시 알림 전송 요청 시작');

    const body = await request.json();
    console.log('[FCM API] 요청 데이터 요약:', {
      mt_idx: body?.mt_idx,
      plt_title: body?.plt_title,
      plt_content: body?.plt_content,
      plt_type: body?.plt_type
    });

    // 1차 시도: HTTPS
    const httpsUrl = `${BACKEND_HOST}/api/v1/fcm_sendone/`;
    console.log('[FCM API] 1차(HTTPS) 백엔드 호출:', httpsUrl);
    try {
      const res = await postToBackend(httpsUrl, body);
      console.log('[FCM API] HTTPS 응답 상태:', res.status, res.statusText);
      const data = await res.json().catch(() => ({ parseError: true }));
      if (!res.ok) {
        console.error('[FCM API] HTTPS 백엔드 오류:', res.status, data);
        // HTTPS가 4xx/5xx면 그대로 반환
        return NextResponse.json(data, { status: res.status });
      }
      console.log('[FCM API] ✅ HTTPS 푸시 전송 성공');
      return NextResponse.json(data);
    } catch (httpsError: any) {
      console.warn('[FCM API] ⚠️ HTTPS 호출 실패, HTTP 폴백 시도:', httpsError?.message || httpsError);
    }

    // 2차 시도: HTTP 폴백 (일부 환경에서 TLS 문제 회피)
    const httpUrl = httpsUrl.replace('https://', 'http://');
    console.log('[FCM API] 2차(HTTP) 백엔드 호출:', httpUrl);
    try {
      const res = await postToBackend(httpUrl, body);
      console.log('[FCM API] HTTP 응답 상태:', res.status, res.statusText);
      const data = await res.json().catch(() => ({ parseError: true }));
      if (!res.ok) {
        console.error('[FCM API] HTTP 백엔드 오류:', res.status, data);
        return NextResponse.json(data, { status: res.status });
      }
      console.log('[FCM API] ✅ HTTP 푸시 전송 성공');
      return NextResponse.json(data);
    } catch (httpError: any) {
      console.error('[FCM API] ❌ HTTP 폴백도 실패:', httpError?.message || httpError);
      return NextResponse.json(
        {
          success: 'false',
          title: '푸시발송(단건) 실패',
          message: '백엔드 연결 실패 (HTTPS/HTTP 모두 실패)',
          data: {
            httpsUrl,
            httpUrl
          }
        },
        { status: 502 }
      );
    }

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