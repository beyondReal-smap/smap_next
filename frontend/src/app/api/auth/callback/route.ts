import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH CALLBACK] API 호출됨');
    
    const body = await request.json();
    const { tokenId, lat, long } = body;
    
    console.log('[AUTH CALLBACK] 요청 데이터:', { 
      hasTokenId: !!tokenId, 
      lat, 
      long 
    });
    
    if (!tokenId) {
      console.error('[AUTH CALLBACK] 토큰이 없음');
      return NextResponse.json(
        { success: false, error: '토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // SSL 인증서 문제 해결을 위한 설정
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

    // 백엔드 API로 토큰 전송
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';
    console.log('[AUTH CALLBACK] 백엔드 URL:', backendUrl);
    
    try {
      const response = await fetch(`${backendUrl}/api/v1/auth/google-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SMAP-NextJS-AuthCallback/1.0'
        },
        body: JSON.stringify({
          idToken: tokenId,
          userInfo: {
            email: 'temp@example.com', // 임시 이메일
            name: 'Temporary User'
          },
          source: 'auth_callback'
        }),
        // 타임아웃 설정
        signal: AbortSignal.timeout(10000)
      });

      console.log('[AUTH CALLBACK] 백엔드 응답 상태:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AUTH CALLBACK] 백엔드 API 오류:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        return NextResponse.json(
          { 
            success: false, 
            error: `백엔드 서버 오류 (${response.status}): ${response.statusText}` 
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('[AUTH CALLBACK] 백엔드 응답 성공:', data);
      
      return NextResponse.json({ success: true, data });
      
    } catch (fetchError: any) {
      console.error('[AUTH CALLBACK] 백엔드 API 호출 실패:', fetchError);
      
      // 네트워크 오류인지 확인
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        return NextResponse.json(
          { success: false, error: '백엔드 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' },
          { status: 503 }
        );
      }
      
      // 타임아웃 오류인지 확인
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { success: false, error: '요청 시간이 초과되었습니다. 다시 시도해주세요.' },
          { status: 408 }
        );
      }
      
      throw fetchError; // 다른 오류는 상위로 전파
    }
    
  } catch (error: any) {
    console.error('[AUTH CALLBACK] 예상치 못한 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: '인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.' 
      },
      { status: 500 }
    );
  }
} 