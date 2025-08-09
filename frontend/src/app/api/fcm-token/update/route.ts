import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fcm_token } = body;

    if (!fcm_token) {
      return NextResponse.json(
        { 
          resultCode: 400, 
          resultMsg: 'FCM 토큰이 필요합니다.',
          resultData: null 
        },
        { status: 400 }
      );
    }

    // 요청 헤더에서 인증 토큰 추출
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json(
        { 
          resultCode: 401, 
          resultMsg: '인증 토큰이 필요합니다.',
          resultData: null 
        },
        { status: 401 }
      );
    }

    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/fcm-token/update`;

    console.log('[FCM Token API] 백엔드 요청:', backendUrl);
    console.log('[FCM Token API] FCM 토큰 길이:', fcm_token.length);

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
      },
      body: JSON.stringify({
        fcm_token: fcm_token
      }),
    });

    const data = await backendResponse.json();
    
    console.log('[FCM Token API] 백엔드 응답:', {
      status: backendResponse.status,
      resultCode: data.resultCode,
      resultMsg: data.resultMsg
    });

    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error) {
    console.error('[FCM Token API] 오류:', error);
    return NextResponse.json(
      { 
        resultCode: 500, 
        resultMsg: '서버 오류가 발생했습니다.',
        resultData: null 
      },
      { status: 500 }
    );
  }
}
