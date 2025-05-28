import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Other Members Location API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: any): Promise<any> {
  // Node.js 환경 변수로 SSL 검증 비활성화
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let response: any;

  try {
    try {
      // 기본 fetch 시도
      response = await fetch(url, options);
    } catch (fetchError) {
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          ...options,
            agent: function(_parsedURL: any) {
              const https = require('https');
              return new https.Agent({
                rejectUnauthorized: false
              });
            }
          });
      } else {
        throw fetchError;
      }
    }

    return response;
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
  const { memberId } = await context.params; // Next.js 15에서 params는 Promise입니다
  try {
    // 다른 API와 동일하게 HTTPS 사용
    const backendUrl = `https://118.67.130.71:8000/api/v1/locations/member/${memberId}`;
    
    console.log('[API PROXY] 다른 멤버 위치 백엔드 호출:', backendUrl);
    
    const response = await fetchWithFallback(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    });

    console.log('[API PROXY] 다른 멤버 위치 백엔드 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 다른 멤버 위치 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : [];
    
    console.log('[API PROXY] 다른 멤버 위치 백엔드 응답 성공, 데이터 길이:', Array.isArray(data) ? data.length : 'object');

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY] 다른 멤버 위치 상세 오류:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      cause: (error as any)?.cause || null,
    });
    
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Error fetching other member locations' }, 
      {
        status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
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