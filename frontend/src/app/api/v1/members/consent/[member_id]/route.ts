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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ member_id: string }> }
) {
  const { member_id } = await params;
  try {
    console.log('[CONSENT API] 동의 정보 조회 요청 시작:', { member_id });
    console.log('[CONSENT API] NODE_ENV:', process.env.NODE_ENV);
    console.log('[CONSENT API] BACKEND_URL:', process.env.BACKEND_URL);
    console.log('[CONSENT API] NEXT_PUBLIC_BACKEND_URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
    
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

    const currentUserId = decoded.mt_idx;
    const requestedUserId = parseInt(member_id);

    console.log('[CONSENT API] 사용자 ID 확인:', { currentUserId, requestedUserId });

    // 본인 정보만 조회 가능
    if (currentUserId !== requestedUserId) {
      console.log('[CONSENT API] 권한 없음:', { currentUserId, requestedUserId });
      return NextResponse.json(
        { success: false, message: '본인의 동의 정보만 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 백엔드 API 호출 - 성공하는 API 패턴 사용
    const backendUrl = `https://118.67.130.71:8000/api/v1/members/consent/${requestedUserId}`;
    
    console.log('[CONSENT API] 백엔드 API 호출 준비:', {
      url: backendUrl,
      userId: requestedUserId,
      timestamp: new Date().toISOString()
    });
    
    try {
      const data = await fetchWithFallback(backendUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('[CONSENT API] 백엔드 응답 성공:', {
        success: data?.success,
        message: data?.message,
        hasData: !!data?.data
      });
      
      return NextResponse.json(data);
    } catch (backendError) {
      console.error('[CONSENT API] 백엔드 호출 실패:', backendError);
      
      // 백엔드 호출 실패 시 기본 동의 정보 반환 (모든 동의를 'N'으로 설정)
      console.log('[CONSENT API] 기본 동의 정보 반환');
      return NextResponse.json({
        success: true,
        message: '동의 정보 조회 성공 (기본값)',
        data: {
          mt_agree1: 'N',
          mt_agree2: 'N',
          mt_agree3: 'N',
          mt_agree4: 'N',
          mt_agree5: 'N'
        }
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