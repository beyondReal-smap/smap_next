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
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const backendUrl = `https://118.67.130.71:8000/api/v1/locations/member/${memberId}`;
    
    console.log('[API PROXY] 다른 멤버 위치 백엔드 호출:', backendUrl);
    
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

    console.log('[API PROXY] 다른 멤버 위치 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY] 다른 멤버 위치 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY] 다른 멤버 위치 백엔드 응답 성공, 데이터 길이:', Array.isArray(data) ? data.length : 'object', '(사용된 방법:', usedMethod + ')');

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
    console.error('[API PROXY] 다른 멤버 위치 상세 오류:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code || 'UNKNOWN',
      cause: (error as any)?.cause || null,
      stack: error instanceof Error ? error.stack : null
    });
    
    // 목업 데이터 반환 - 다른 멤버들의 위치 정보
    const mockData = [
      {
        slt_idx: 1,
        slt_title: '김철수네 회사',
        slt_add: '서울시 강남구 테헤란로 123',
        slt_lat: '37.5665',
        slt_long: '126.9780',
        slt_enter_alarm: 'Y',
        slt_show: 'Y'
      },
      {
        slt_idx: 2,
        slt_title: '김철수 단골 카페',
        slt_add: '서울시 강남구 역삼동 456',
        slt_lat: '37.5612',
        slt_long: '126.9966',
        slt_enter_alarm: 'N',
        slt_show: 'Y'
      },
      {
        slt_idx: 3,
        slt_title: '김철수 헬스장',
        slt_add: '서울시 강남구 삼성동 789',
        slt_lat: '37.5172',
        slt_long: '127.0473',
        slt_enter_alarm: 'Y',
        slt_show: 'Y'
      }
    ];

    console.log('[API PROXY] 다른 멤버 위치 목업 데이터 반환:', mockData.length, '개 항목');

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