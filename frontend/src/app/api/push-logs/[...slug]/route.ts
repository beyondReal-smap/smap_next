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
    const backendUrl = `https://api3.smap.site/api/v1/push-logs/${path}`;

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
            agent: function (_parsedURL: any) {
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

    // member 경로일 때 최근 7일 필터링 적용
    let filteredData = data;
    if (path.startsWith('member/') && Array.isArray(data)) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0); // 7일 전 자정으로 설정

      filteredData = data.filter((log: any) => {
        const logDate = new Date(log.plt_sdate);
        return logDate >= sevenDaysAgo;
      });
    }

    return NextResponse.json(filteredData, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Fetch-Method': usedMethod,
      },
    });
  } catch (error) {
    console.error('[API PROXY /push-logs] 상세 오류:', error);

    // 목업 데이터 대신 빈 배열 반환 (김철수 등 더미 데이터 제거)
    return NextResponse.json([], {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'X-Data-Source': 'empty-fallback',
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
    const backendUrl = `https://api3.smap.site/api/v1/push-logs/${path}`;

    if (path === 'read-all' || path === 'delete-all') {
      const url = new URL(request.url);
      const mt_idx = url.searchParams.get('mt_idx');
      if (!mt_idx) {
        return NextResponse.json({ error: 'mt_idx is required' }, { status: 400 });
      }

      const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

      let response: any;
      try {
        response = await fetch(`${backendUrl}?mt_idx=${mt_idx}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy',
          },
        });
      } finally {
        if (originalTlsReject !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    const body = await request.json();
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API PROXY /push-logs] POST 오류:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
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
    const backendUrl = `https://api3.smap.site/api/v1/push-logs/${path}`;

    const response = await fetch(backendUrl, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API PROXY /push-logs] DELETE 오류:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
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
    const backendUrl = `https://api3.smap.site/api/v1/push-logs/${path}`;

    const body = await request.json().catch(() => ({}));
    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API PROXY /push-logs] PATCH 오류:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Origins': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}