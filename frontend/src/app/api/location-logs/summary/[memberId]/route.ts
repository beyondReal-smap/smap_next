import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Location Summary API] node-fetch 패키지를 찾을 수 없음');
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
      console.log('[Location Summary API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Location Summary API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
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
        console.log('[Location Summary API] node-fetch 성공');
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  
  try {
    console.log('[Location Summary API] 위치 요약 조회 요청:', { memberId, date });

    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 });
    }

    // 백엔드 API 호출
    const backendUrl = `https://118.67.130.71:8000/api/v1/logs/member-location-logs/${memberId}/summary?date=${date}`;
    console.log('[Location Summary API] 백엔드 API 호출:', backendUrl);
    
    const data = await fetchWithFallback(backendUrl);
    console.log('[Location Summary API] 백엔드 응답 성공:', data);
    
    return NextResponse.json(data, {
      headers: {
        'X-Data-Source': 'backend-direct'
      }
    });

  } catch (error) {
    console.error('[Location Summary API] 오류:', error);
    
    // 목업 데이터 반환
    const mockData = {
      total_distance: 8.5,
      total_time: "4시간 30분",
      step_count: 12500,
      average_speed: 1.9,
      battery_consumption: 15
    };
    
    console.error('[Location Summary API] 백엔드 호출 실패, 목업 데이터 반환');
    return NextResponse.json(mockData, {
      headers: {
        'X-Data-Source': 'mock'
      }
    });
  }
} 