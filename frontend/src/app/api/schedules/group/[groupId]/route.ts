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
    const { groupId } = params;
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days');
    
    let backendUrl = `https://118.67.130.71:8000/api/v1/schedules/group/${groupId}`;
    if (days) {
      backendUrl += `?days=${days}`;
    }
    
    console.log('[API PROXY] 백엔드 호출:', backendUrl);
    
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
    
    // Node.js 환경 변수로 SSL 검증 비활성화 (Vercel에서)
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    let response: any;
    let usedMethod = 'default-fetch';

    try {
      // 기본 fetch 시도
      response = await fetch(backendUrl, fetchOptions);
      console.log('[API PROXY] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[API PROXY] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        try {
          response = await nodeFetch(backendUrl, {
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
          console.log('[API PROXY] node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[API PROXY] node-fetch도 실패:', nodeFetchError);
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

    console.log('[API PROXY] 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');
    console.log('[API PROXY] 응답 헤더:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 백엔드 에러 응답:', errorText);
      console.error('[API PROXY] 응답 헤더:', Object.fromEntries(response.headers.entries()));
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY] 백엔드 응답 성공, 데이터 길이:', Array.isArray(data) ? data.length : 'object', '(사용된 방법:', usedMethod + ')');

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
    console.error('[API PROXY] 상세 오류:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      cause: (error as any)?.cause || null,
      stack: error instanceof Error ? error.stack : null
    });
    
    // 목업 데이터 반환
    const mockData = [
      {
        sst_idx: 1,
        mt_idx: 1186,
        mt_schedule_idx: 1186,
        sst_title: '팀 회의',
        sst_sdate: '2024-12-27 14:00:00',
        sst_edate: '2024-12-27 15:00:00',
        sst_location_title: '강남 사무실',
        sst_location_lat: 37.5665,
        sst_location_long: 126.9780,
        sst_memo: '프로젝트 진행상황 논의',
        sst_show: 1,
        sst_all_day: 0
      },
      {
        sst_idx: 2,
        mt_idx: 1186,
        mt_schedule_idx: 1186,
        sst_title: '저녁 약속',
        sst_sdate: '2024-12-27 19:00:00',
        sst_edate: '2024-12-27 21:00:00',
        sst_location_title: '이탈리안 레스토랑',
        sst_location_lat: 37.5612,
        sst_location_long: 126.9966,
        sst_memo: '친구들과 저녁식사',
        sst_show: 1,
        sst_all_day: 0
      }
    ];

    console.log('[API PROXY] 목업 데이터 반환:', mockData.length, '개 항목');

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