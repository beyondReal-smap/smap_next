import { NextRequest, NextResponse } from 'next/server';

// SMAP iOS 위치 로그 API 라우터 - 405 에러 해결용
const BACKEND_URL = process.env.BACKEND_URL || 'https://118.67.130.71:8000';

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  // SSL 검증 비활성화 (개발/테스트 환경용)
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      ...options
    });

    // SSL 설정 복원
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Member Location Logs API] 백엔드 응답 오류:', { 
        status: response.status, 
        statusText: response.statusText,
        errorText 
      });
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    // SSL 설정 복원 (에러 시에도)
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Member Location Logs API] 위치 로그 요청:', body);

    // act 파라미터 검증
    if (!body.act) {
      return NextResponse.json({
        result: "N",
        error: "'act' parameter is required"
      }, { status: 400 });
    }

    // mt_idx 검증 (create_location_log인 경우에만)
    if (body.act === 'create_location_log' && !body.mt_idx) {
      console.warn('[Member Location Logs API] mt_idx가 없음, 기본값 사용');
      body.mt_idx = 282; // 기본값 설정 (실제 로그인된 사용자 ID로 교체 필요)
    }

    // 백엔드 API 호출
    const backendUrl = `${BACKEND_URL}/api/v1/logs/member-location-logs`;
    console.log('[Member Location Logs API] 백엔드 API 호출:', backendUrl, body);

    const data = await fetchWithFallback(backendUrl, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    console.log('[Member Location Logs API] 백엔드 응답 성공:', data);
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Member Location Logs API] 전체 에러:', error);
    
    // 에러 응답
    return NextResponse.json({
      result: "N",
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '위치 로그 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mtIdx = searchParams.get('mt_idx');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';

    if (!mtIdx) {
      return NextResponse.json({
        result: "N",
        error: "mt_idx parameter is required"
      }, { status: 400 });
    }

    // 백엔드 API 호출 (GET 방식)
    const backendUrl = `${BACKEND_URL}/api/v1/logs/member-location-logs/${mtIdx}?start_date=${startDate}&end_date=${endDate}&limit=${limit}&offset=${offset}`;
    console.log('[Member Location Logs API] GET 요청:', backendUrl);

    const data = await fetchWithFallback(backendUrl, {
      method: 'GET'
    });

    console.log('[Member Location Logs API] GET 응답 성공');
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Member Location Logs API] GET 에러:', error);
    
    return NextResponse.json({
      result: "N",
      error: error instanceof Error ? error.message : 'Unknown error',
      message: '위치 로그 조회 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}