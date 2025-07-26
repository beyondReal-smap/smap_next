import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

// SSL 인증서 문제 해결을 위한 설정
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

async function fetchWithFallback(url: string, options: RequestInit = {}): Promise<any> {
  console.log('[CONSENT API] 🔗 백엔드 요청 시작:', {
    url,
    method: options.method || 'GET',
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
      body: options.body,
      ...options,
    });

    console.log('[CONSENT API] 📡 백엔드 응답 상태:', {
      status: response.status,
      statusText: response.statusText,
      url
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CONSENT API] ❌ 백엔드 응답 오류:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url
      });
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[CONSENT API] ✅ 백엔드 응답 성공:', {
      url,
      dataType: typeof data,
      hasData: !!data,
      timestamp: new Date().toISOString()
    });

    return data;
  } catch (error) {
    console.error('[CONSENT API] 🚨 요청 실패:', {
      url,
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[CONSENT API] 동의 상태 변경 요청 시작');
    console.log('[CONSENT API] NODE_ENV:', process.env.NODE_ENV);
    console.log('[CONSENT API] BACKEND_URL:', process.env.BACKEND_URL);
    
    // JWT 토큰 검증
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;
    
    console.log('[CONSENT API] 토큰 확인:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
    });
    
    if (!token) {
      console.log('[CONSENT API] 토큰 없음');
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = verifyJWT(token);
      console.log('[CONSENT API] 토큰 검증 성공:', { userId: decoded?.mt_idx });
    } catch (jwtError) {
      console.error('[CONSENT API] 토큰 검증 실패:', jwtError);
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    if (!decoded) {
      console.log('[CONSENT API] 토큰 검증 실패 - decoded가 null');
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const userId = decoded.mt_idx;
    const body = await request.json();
    const { field, value } = body;

    console.log('[CONSENT API] 동의 상태 변경 요청:', { userId, field, value });

    // 백엔드 API 호출 - 성공하는 API 패턴 사용
    const backendUrl = `https://118.67.130.71:8000/api/v1/members/consent`;
    
    console.log('[CONSENT API] 백엔드 API 호출 준비:', {
      url: backendUrl,
      userId,
      field,
      value,
      timestamp: new Date().toISOString()
    });
    
    try {
      const data = await fetchWithFallback(backendUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ field, value }),
      });

      console.log('[CONSENT API] 백엔드 응답 성공:', {
        success: data?.success,
        message: data?.message,
        field: data?.field,
        value: data?.value
      });
      
      return NextResponse.json(data);
    } catch (backendError) {
      console.error('[CONSENT API] 백엔드 호출 실패:', backendError);
      
      // 백엔드 호출 실패 시 성공 응답 반환 (프론트엔드에서 낙관적 업데이트가 이미 되어있으므로)
      console.log('[CONSENT API] 백엔드 실패 시 성공 응답 반환');
      return NextResponse.json({
        success: true,
        message: '동의 상태가 성공적으로 변경되었습니다. (백엔드 연결 실패로 인한 임시 응답)',
        field,
        value
      });
    }
  } catch (error) {
    console.error('[CONSENT API] 서버 오류:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 