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
    console.log('[API PROXY /push-logs] 요청 경로:', path);
    console.log('[API PROXY /push-logs] member 경로 체크:', path.startsWith('member/'));

    // member 경로일 때 최근 7일 필터링 적용
    let filteredData = data;
    if (path.startsWith('member/') && Array.isArray(data)) {
      console.log('[API PROXY /push-logs] 7일 필터링 시작...');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0); // 7일 전 자정으로 설정
      
      console.log('[API PROXY /push-logs] 7일 전 기준 날짜:', sevenDaysAgo.toISOString());
      
      filteredData = data.filter((log: any) => {
        const logDate = new Date(log.plt_sdate);
        const isRecent = logDate >= sevenDaysAgo;
        if (!isRecent) {
          console.log('[API PROXY /push-logs] 필터링됨:', log.plt_sdate, '→', logDate.toISOString());
        }
        return isRecent;
      });
      
      console.log(`[API PROXY /push-logs] 7일 필터링 적용: 전체 ${data.length}개 → 필터링 후 ${filteredData.length}개`);
    } else {
      console.log('[API PROXY /push-logs] 7일 필터링 건너뜀 - 조건 불충족');
    }

    return NextResponse.json(filteredData, {
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
    
    // read-all의 경우 쿼리 파라미터에서 mt_idx 추출
    if (path === 'read-all') {
      const url = new URL(request.url);
      const mt_idx = url.searchParams.get('mt_idx');
      if (!mt_idx) {
        return NextResponse.json({ error: 'mt_idx is required' }, { status: 400 });
      }
      
      console.log('[API PROXY /push-logs] READ-ALL 요청:', `${backendUrl}?mt_idx=${mt_idx}`);
      
      // SSL 인증서 우회 설정
      const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      let response: any;
      let usedMethod = 'default-fetch';
      
      try {
        // 기본 fetch 시도
        response = await fetch(`${backendUrl}?mt_idx=${mt_idx}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy',
          },
          // @ts-ignore
          rejectUnauthorized: false,
        });
        console.log('[API PROXY /push-logs] READ-ALL 기본 fetch 성공');
      } catch (fetchError) {
        console.log('[API PROXY /push-logs] READ-ALL 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
        
        if (nodeFetch) {
          try {
            response = await nodeFetch(`${backendUrl}?mt_idx=${mt_idx}`, {
              method: 'POST',
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
            usedMethod = 'node-fetch';
            console.log('[API PROXY /push-logs] READ-ALL node-fetch 성공');
          } catch (nodeFetchError) {
            console.error('[API PROXY /push-logs] READ-ALL node-fetch도 실패:', nodeFetchError);
            throw fetchError;
          }
        } else {
          throw fetchError;
        }
      } finally {
        // 환경 변수 복원
        if (originalTlsReject !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      }

      console.log('[API PROXY /push-logs] READ-ALL 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY /push-logs] READ-ALL 백엔드 에러:', errorText);
        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[API PROXY /push-logs] READ-ALL 성공:', data);
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-Fetch-Method': usedMethod,
        },
      });
    }

    // delete-all의 경우 쿼리 파라미터에서 mt_idx 추출
    if (path === 'delete-all') {
      const url = new URL(request.url);
      const mt_idx = url.searchParams.get('mt_idx');
      if (!mt_idx) {
        return NextResponse.json({ error: 'mt_idx is required' }, { status: 400 });
      }
      
      console.log('[API PROXY /push-logs] DELETE-ALL 요청:', `${backendUrl}?mt_idx=${mt_idx}`);
      
      // SSL 인증서 우회 설정
      const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      
      let response: any;
      let usedMethod = 'default-fetch';
      
      try {
        // 기본 fetch 시도
        response = await fetch(`${backendUrl}?mt_idx=${mt_idx}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy',
          },
          // @ts-ignore
          rejectUnauthorized: false,
        });
        console.log('[API PROXY /push-logs] DELETE-ALL 기본 fetch 성공');
      } catch (fetchError) {
        console.log('[API PROXY /push-logs] DELETE-ALL 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
        
        if (nodeFetch) {
          try {
            response = await nodeFetch(`${backendUrl}?mt_idx=${mt_idx}`, {
              method: 'POST',
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
            usedMethod = 'node-fetch';
            console.log('[API PROXY /push-logs] DELETE-ALL node-fetch 성공');
          } catch (nodeFetchError) {
            console.error('[API PROXY /push-logs] DELETE-ALL node-fetch도 실패:', nodeFetchError);
            throw fetchError;
          }
        } else {
          throw fetchError;
        }
      } finally {
        // 환경 변수 복원
        if (originalTlsReject !== undefined) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
        } else {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
      }

      console.log('[API PROXY /push-logs] DELETE-ALL 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY /push-logs] DELETE-ALL 백엔드 에러:', errorText);
        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[API PROXY /push-logs] DELETE-ALL 성공:', data);
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'X-Fetch-Method': usedMethod,
        },
      });
    }

    // 다른 POST 요청들은 기존 로직 유지
    const body = await request.json();
    
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
    
    // read-all의 경우 쿼리 파라미터 처리
    let backendUrl = `https://118.67.130.71:8000/api/v1/push-logs/${path}`;
    if (path === 'read-all') {
      const url = new URL(request.url);
      const mt_idx = url.searchParams.get('mt_idx');
      if (!mt_idx) {
        return NextResponse.json({ error: 'mt_idx is required' }, { status: 400 });
      }
      backendUrl = `${backendUrl}?mt_idx=${mt_idx}`;
    }
    
    const body = await request.json().catch(() => ({})); // body가 없을 수도 있음
    console.log('[API PROXY /push-logs] PATCH 요청 시작:', backendUrl);
    console.log('[API PROXY /push-logs] PATCH 요청 body:', body);
    console.log('[API PROXY /push-logs] PATCH 요청 path:', path);
    
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
    let usedMethod = 'default-fetch';
    
    try {
      console.log('[API PROXY /push-logs] PATCH 기본 fetch 시도...');
      response = await fetch(backendUrl, fetchOptions);
      console.log('[API PROXY /push-logs] PATCH 기본 fetch 성공, 상태:', response.status);
    } catch (fetchError) {
      console.log('[API PROXY /push-logs] PATCH 기본 fetch 실패:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        try {
          console.log('[API PROXY /push-logs] PATCH node-fetch 시도...');
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
          usedMethod = 'node-fetch';
          console.log('[API PROXY /push-logs] PATCH node-fetch 성공, 상태:', response.status);
        } catch (nodeFetchError) {
          console.error('[API PROXY /push-logs] PATCH node-fetch도 실패:', nodeFetchError);
          throw fetchError;
        }
      } else {
        console.log('[API PROXY /push-logs] node-fetch 패키지 없음');
        throw fetchError;
      }
    } finally {
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }

    console.log('[API PROXY /push-logs] PATCH 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY /push-logs] PATCH 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY /push-logs] PATCH 백엔드 응답 성공:', data);
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[API PROXY /push-logs] PATCH 상세 오류:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      cause: (error as any)?.cause || null,
    });
    
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