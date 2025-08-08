import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUserId } from '@/lib/auth';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Groups API] node-fetch 패키지를 찾을 수 없음');
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    const searchParams = request.nextUrl.searchParams;
    // mt_idx는 인증된 사용자 ID 사용
    const mt_idx = getCurrentUserId(request)?.toString();
    
    if (!mt_idx) {
      console.log('[Groups API] 인증된 사용자 ID가 없음, 빈 배열 반환');
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    console.log('[Groups API] 그룹 목록 조회 요청:', { mt_idx });

    // 기존 작동하던 백엔드 API 호출
    const backendUrl = `https://api3.smap.site/api/v1/groups/member/${mt_idx}`;
    console.log('[Groups API] 백엔드 호출:', backendUrl);
    
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
      console.log('[Groups API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Groups API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
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
          console.log('[Groups API] node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[Groups API] node-fetch도 실패:', nodeFetchError);
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

    console.log('[Groups API] 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Groups API] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Groups API] 백엔드 응답 데이터:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      count: Array.isArray(data) ? data.length : 'N/A',
      sampleData: Array.isArray(data) && data.length > 0 ? data[0] : data
    });

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('[Groups API] 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '그룹 목록을 가져오는데 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    const body = await request.json();
    console.log('[Groups API] 그룹 생성 요청:', body);

    // 백엔드 그룹 생성 API 호출
    const backendUrl = 'https://api3.smap.site/api/v1/groups';
    console.log('[Groups API] 백엔드 그룹 생성 호출:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
      body: JSON.stringify(body),
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
      console.log('[Groups API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Groups API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        try {
          response = await nodeFetch(backendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Next.js API Proxy (node-fetch)',
            },
            body: JSON.stringify(body),
            // node-fetch의 SSL 우회 옵션
            agent: function(_parsedURL: any) {
              const https = require('https');
              return new https.Agent({
                rejectUnauthorized: false
              });
            }
          });
          usedMethod = 'node-fetch';
          console.log('[Groups API] node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[Groups API] node-fetch도 실패:', nodeFetchError);
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

    console.log('[Groups API] 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Groups API] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Groups API] 백엔드 그룹 생성 응답:', data);

    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('[Groups API] 그룹 생성 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '그룹 생성에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 