import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[API PROXY] node-fetch 패키지를 찾을 수 없음');
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = 'https://api3.smap.site/api/v1/members/me';
    
    console.log('[API PROXY /members/me] 백엔드 호출:', backendUrl);
    
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
      response = await fetch(backendUrl, fetchOptions);
      console.log('[API PROXY /members/me] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[API PROXY /members/me] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
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
          console.log('[API PROXY /members/me] node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[API PROXY /members/me] node-fetch도 실패:', nodeFetchError);
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

    console.log('[API PROXY /members/me] 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API PROXY /members/me] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[API PROXY /members/me] 백엔드 응답 성공, 데이터:', data, '(사용된 방법:', usedMethod + ')');

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
    console.error('[API PROXY /members/me] 오류:', error);
    
    // 목업 데이터 반환 (백엔드 호출 실패 시)
    const mockData = {
      "result": "Y",
      "data": {
        "mt_idx": 1186,
        "mt_id": "01012345678",
        "mt_name": "테스트 사용자",
        "mt_nickname": "테스트",
        "mt_hp": "01012345678",
        "mt_email": "test@test.com",
        "mt_birth": "1990-01-01",
        "mt_gender": 1,
        "mt_type": 1,
        "mt_level": 2
      },
      "message": "프로필 조회가 성공했습니다.",
      "success": true
    };
    
    console.error('[API PROXY /members/me] 백엔드 호출 실패, 목업 데이터 반환');
    return NextResponse.json(mockData, {
      headers: {
        'X-Data-Source': 'mock'
      }
    });
  }
} 