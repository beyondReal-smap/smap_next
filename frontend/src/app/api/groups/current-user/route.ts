import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Current User Groups API] node-fetch 패키지를 찾을 수 없음');
}

export async function GET(request: NextRequest) {
  try {
    console.log('[Current User Groups API] 현재 사용자 그룹 목록 조회 요청');

    // 현재 로그인한 사용자 ID 가져오기
    const currentUserId = getCurrentUserId(request);
    console.log('[Current User Groups API] 현재 사용자 ID:', currentUserId);

    // Authorization 헤더에서 토큰 추출
    const authorization = request.headers.get('authorization');
    console.log('[Current User Groups API] Authorization 헤더:', authorization ? '토큰 있음' : '토큰 없음');
    
    // 백엔드 API 호출 - 현재 사용자의 그룹 목록 조회
    const backendUrl = 'https://118.67.130.71:8000/api/v1/groups/current-user';
    console.log('[Current User Groups API] 백엔드 호출:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...(authorization && { 'Authorization': authorization }),
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
      console.log('[Current User Groups API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Current User Groups API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        try {
          response = await nodeFetch(backendUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'Next.js API Proxy (node-fetch)',
              ...(authorization && { 'Authorization': authorization }),
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
          console.log('[Current User Groups API] node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[Current User Groups API] node-fetch도 실패:', nodeFetchError);
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

    console.log('[Current User Groups API] 백엔드 응답 상태:', response.status, response.statusText, '(사용된 방법:', usedMethod + ')');

    // 401 또는 422 에러가 발생한 경우 대체 방법으로 현재 사용자 ID를 직접 사용
    if (!response.ok && (response.status === 401 || response.status === 422)) {
      const errorText = await response.text();
      console.log('[Current User Groups API] 인증 실패, 현재 사용자 ID로 재시도:', errorText);
      
      // 현재 사용자 ID가 없으면 빈 배열 반환 (신규 사용자)
      if (!currentUserId) {
        console.log('[Current User Groups API] 인증된 사용자 ID가 없음, 빈 배열 반환');
        return NextResponse.json([]);
      }
      
      const userIdToUse = currentUserId;
      console.log('[Current User Groups API] 사용할 사용자 ID:', userIdToUse);
      
      // 올바른 백엔드 엔드포인트 사용: /groups/member/{member_id}
      const fallbackUrl = `https://118.67.130.71:8000/api/v1/groups/member/${userIdToUse}`;
      console.log('[Current User Groups API] 대체 API 호출:', fallbackUrl);
      
      try {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy (fallback)',
          },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('[Current User Groups API] 대체 API 성공:', fallbackData);
          return NextResponse.json(fallbackData);
        } else {
          const fallbackErrorText = await fallbackResponse.text();
          console.error('[Current User Groups API] 대체 API 실패:', fallbackResponse.status, fallbackErrorText);
        }
      } catch (fallbackError) {
        console.error('[Current User Groups API] 대체 API도 실패:', fallbackError);
      }
      
      // 모든 방법이 실패하면 원래 에러 반환
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Current User Groups API] 백엔드 에러 응답:', errorText);
      throw new Error(`Backend API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Current User Groups API] 백엔드 응답 데이터:', {
      dataType: Array.isArray(data) ? 'array' : typeof data,
      count: Array.isArray(data) ? data.length : 'N/A',
      sampleData: Array.isArray(data) && data.length > 0 ? data[0] : data
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('[Current User Groups API] 오류:', error);
    
    // 최후의 수단으로 빈 배열 반환 (신규 사용자는 그룹이 없음)
    const currentUserIdForMock = getCurrentUserId(request);
    console.log('[Current User Groups API] 에러 발생, 사용자 ID:', currentUserIdForMock);
    
    // 신규 사용자는 그룹이 없으므로 빈 배열 반환
    console.log('[Current User Groups API] 빈 배열 반환 (신규 사용자)');
    return NextResponse.json([]);
  }
} 