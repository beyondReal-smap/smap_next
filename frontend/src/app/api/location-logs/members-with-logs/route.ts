import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Members With Logs API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
      ...options.headers,
    },
    body: options.body,
    // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
    rejectUnauthorized: false,
  };
  
  // Node.js 환경 변수로 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  let response: any;

  try {
    try {
      // 기본 fetch 시도
      response = await fetch(url, fetchOptions);
      console.log('[Members With Logs API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Members With Logs API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy (node-fetch)',
            ...options.headers,
          },
          body: options.body,
          agent: function(_parsedURL: any) {
            const https = require('https');
            return new https.Agent({
              rejectUnauthorized: false
            });
          }
        });
        console.log('[Members With Logs API] node-fetch 성공');
      } else {
        throw fetchError;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } finally {
    // 환경 변수 복원
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');
  const date = searchParams.get('date');
  
  try {
    console.log('[Members With Logs API] 로그가 있는 멤버 목록 조회 요청:', { groupId, date });

    if (!groupId || !date) {
      return NextResponse.json({ error: 'group_id and date parameters are required' }, { status: 400 });
    }

    // 백엔드 API 호출
    const backendUrl = `https://api3.smap.site/api/v1/logs/members-with-logs?group_id=${groupId}&date=${date}`;
    console.log('[Members With Logs API] 백엔드 API 호출:', backendUrl);
    
    const data = await fetchWithFallback(backendUrl);
    console.log('[Members With Logs API] 백엔드 응답 성공:', { 
      dataLength: Array.isArray(data) ? data.length : 'not array'
    });
    
    return NextResponse.json(data, {
      headers: {
        'X-Data-Source': 'backend-direct'
      }
    });

  } catch (error) {
    console.error('[Members With Logs API] 오류:', error);
    
    // 목업 데이터 반환
    const mockData = [282, 1186];
    
    console.error('[Members With Logs API] 백엔드 호출 실패, 목업 데이터 반환');
    return NextResponse.json(mockData, {
      headers: {
        'X-Data-Source': 'mock'
      }
    });
  }
} 