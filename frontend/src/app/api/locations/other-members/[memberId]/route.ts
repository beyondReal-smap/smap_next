import { NextRequest, NextResponse } from 'next/server';

async function fetchWithRetry(url: string, options: any, retries = 3): Promise<any> {
  // Node.js 환경에서 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  try {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[API PROXY] 시도 ${i + 1}/${retries}: ${url}`);
        
        const response = await fetch(url, {
          ...options,
          // 타임아웃 설정
          signal: AbortSignal.timeout(10000), // 10초 타임아웃
        });
        
        console.log(`[API PROXY] 응답 상태: ${response.status}`);
        return response;
        
      } catch (error) {
        console.error(`[API PROXY] 시도 ${i + 1} 실패:`, error);
        
        if (i === retries - 1) {
          throw error;
        }
        
        // 재시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  } finally {
    // 환경 변수 복원
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await context.params;
  
  try {
    console.log(`[API PROXY] 멤버 ${memberId}의 장소 데이터 조회 시작`);
    
    // HTTPS 백엔드 URL
    const backendUrl = `https://118.67.130.71:8000/api/v1/locations/member/${memberId}`;
    
    const response = await fetchWithRetry(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 백엔드 에러 응답:', errorText);
      
      // 백엔드 서버가 응답하지 않는 경우 목업 데이터 반환
      if (response.status >= 500) {
        console.log('[API PROXY] 서버 오류로 인해 목업 데이터 반환');
        return NextResponse.json([], {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }
      
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : [];
    
    console.log(`[API PROXY] 멤버 ${memberId} 장소 데이터 조회 성공:`, Array.isArray(data) ? data.length : 'object');

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error(`[API PROXY] 멤버 ${memberId} 장소 조회 실패:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // 네트워크 오류나 서버 연결 실패 시 빈 배열 반환
    console.log('[API PROXY] 오류로 인해 빈 장소 목록 반환');
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 