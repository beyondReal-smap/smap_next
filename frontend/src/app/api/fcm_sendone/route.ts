import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api3.smap.site';

export async function POST(request: NextRequest) {
  try {
    console.log('[FCM API] 푸시 알림 전송 요청 시작');
    
    // 요청 본문 파싱
    const body = await request.json();
    console.log('[FCM API] 요청 데이터:', {
      ...body,
      mt_id: body.mt_id // 민감한 정보는 로그에서 제외
    });

    // 백엔드 API URL
    const backendUrl = `${BACKEND_URL}/api/v1/fcm_sendone/`;
    console.log('[FCM API] 백엔드 URL:', backendUrl);

    // SSL 인증서 검증 비활성화 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // 백엔드로 요청 전송
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(body),
      // 타임아웃 설정
      signal: AbortSignal.timeout(10000)
    });

    console.log('[FCM API] 백엔드 응답 상태:', response.status, response.statusText);

    // 응답 데이터 파싱
    const responseData = await response.json();
    console.log('[FCM API] 백엔드 응답 데이터:', responseData);

    if (!response.ok) {
      console.error('[FCM API] 백엔드 오류:', response.status, responseData);
      return NextResponse.json(
        responseData,
        { status: response.status }
      );
    }

    console.log('[FCM API] ✅ 푸시 알림 전송 성공');
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[FCM API] ❌ 푸시 알림 전송 실패:', error);
    
    return NextResponse.json(
      {
        success: "false",
        title: "푸시발송(단건) 실패",
        message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: null
      },
      { status: 500 }
    );
  }
} 