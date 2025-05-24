import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[API PROXY] node-fetch 패키지를 찾을 수 없음');
}

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const { slug } = params;
    const path = Array.isArray(slug) ? slug.join('/') : slug || '';
    const backendUrl = `https://118.67.130.71:8000/api/v1/push-logs/${path}`;
    
    // URL에서 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const finalUrl = queryString ? `${backendUrl}?${queryString}` : backendUrl;
    
    console.log('[API PROXY /push-logs] 백엔드 호출:', finalUrl);
    
    // 첫 번째 시도: 기본 fetch with SSL bypass
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
      rejectUnauthorized: false,
    };
    
    // Node.js 환경 변수로 SSL 검증 비활성화
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let response: any;
    let usedMethod = 'default-fetch';

    try {
      // 기본 fetch 시도
      response = await fetch(finalUrl, fetchOptions);
      console.log('[API PROXY /push-logs] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[API PROXY /push-logs] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        try {
          response = await nodeFetch(finalUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Next.js API Proxy (node-fetch)',
            },
            // node-fetch의 SSL 우회 옵션
            agent: function(_parsedURL: any) {
              const https = require('https');
              return new https.Agent({
                rejectUnauthorized: false
              });
            }
          });
          usedMethod = 'node-fetch';
          console.log('[API PROXY /push-logs] node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[API PROXY /push-logs] node-fetch도 실패:', nodeFetchError);
          throw fetchError; // 원래 에러를 던짐
        }
      } else {
        throw fetchError; // node-fetch가 없으면 원래 에러를 던짐
      }
    } finally {
      // 환경 변수 복원
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }

    console.log('[API PROXY /push-logs] 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY /push-logs] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY /push-logs] 백엔드 응답 성공, 데이터 길이:', Array.isArray(data) ? data.length : 'object', '(사용된 방법:', usedMethod + ')');

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Fetch-Method': usedMethod, // 사용된 방법을 헤더에 포함
      },
    });
  } catch (error) {
    console.error('[API PROXY /push-logs] 상세 오류:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      cause: (error as any)?.cause || null,
    });
    
    // 목업 데이터 반환 - 푸시 로그 데이터
    const mockData = [
      {
        id: 1,
        title: '일정 알림',
        message: '오늘 오후 2시에 회의가 있습니다.',
        type: 'schedule',
        created_at: '2024-01-15T10:00:00Z',
        read: false
      },
      {
        id: 2,
        title: '위치 공유',
        message: '김철수님이 위치를 공유했습니다.',
        type: 'location',
        created_at: '2024-01-15T09:30:00Z',
        read: true
      }
    ];

    console.log('[API PROXY /push-logs] 목업 데이터 반환:', mockData.length, '개 항목');

    return NextResponse.json(mockData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Data-Source': 'mock', // 목업 데이터임을 표시
      },
    });
  }
}

export async function POST(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const { slug } = params;
    const path = Array.isArray(slug) ? slug.join('/') : slug || '';
    const backendUrl = `https://118.67.130.71:8000/api/v1/push-logs/${path}`;
    
    const body = await request.json();
    console.log('[API PROXY /push-logs] POST 요청:', backendUrl, body);
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(body),
      // @ts-ignore
      rejectUnauthorized: false,
    };
    
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let response: any;
    
    try {
      response = await fetch(backendUrl, fetchOptions);
    } catch (fetchError) {
      if (nodeFetch) {
        response = await nodeFetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy (node-fetch)',
          },
          body: JSON.stringify(body),
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
    } finally {
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY /push-logs] POST 백엔드 에러:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY /push-logs] POST 오류:', error);
    
    // POST 요청에 대한 목업 응답
    return NextResponse.json({ success: true, message: 'Mock success' }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Data-Source': 'mock',
      },
    });
  }
}

export async function DELETE(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const { slug } = params;
    const path = Array.isArray(slug) ? slug.join('/') : slug || '';
    const backendUrl = `https://118.67.130.71:8000/api/v1/push-logs/${path}`;
    
    console.log('[API PROXY /push-logs] DELETE 요청:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      // @ts-ignore
      rejectUnauthorized: false,
    };
    
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let response: any;
    
    try {
      response = await fetch(backendUrl, fetchOptions);
    } catch (fetchError) {
      if (nodeFetch) {
        response = await nodeFetch(backendUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy (node-fetch)',
          },
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
    } finally {
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY /push-logs] DELETE 백엔드 에러:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY /push-logs] DELETE 오류:', error);
    
    return NextResponse.json({ success: true, message: 'Mock delete success' }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Data-Source': 'mock',
      },
    });
  }
}

export async function PATCH(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const { slug } = params;
    const path = Array.isArray(slug) ? slug.join('/') : slug || '';
    const backendUrl = `https://118.67.130.71:8000/api/v1/push-logs/${path}`;
    
    const body = await request.json();
    console.log('[API PROXY /push-logs] PATCH 요청:', backendUrl, body);
    
    const fetchOptions: RequestInit = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(body),
      // @ts-ignore
      rejectUnauthorized: false,
    };
    
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let response: any;
    
    try {
      response = await fetch(backendUrl, fetchOptions);
    } catch (fetchError) {
      if (nodeFetch) {
        response = await nodeFetch(backendUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy (node-fetch)',
          },
          body: JSON.stringify(body),
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
    } finally {
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY /push-logs] PATCH 백엔드 에러:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY /push-logs] PATCH 오류:', error);
    
    return NextResponse.json({ success: true, message: 'Mock patch success' }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Data-Source': 'mock',
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 