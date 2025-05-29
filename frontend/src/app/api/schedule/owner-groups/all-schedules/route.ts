import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[API PROXY] node-fetch 패키지를 찾을 수 없음');
}

export async function GET(request: NextRequest) {
  console.log('[API PROXY] ⭐ Owner Groups All Schedules GET 요청 시작 ⭐');
  console.log('[API PROXY] 요청 URL:', request.url);
  
  try {
    const { searchParams } = new URL(request.url);
    const currentUserId = searchParams.get('current_user_id') || '1186'; // 기본값
    const days = searchParams.get('days') || '7'; // 기본 7일

    console.log('[API PROXY] 파라미터 추출 완료:', { currentUserId, days });

    // 백엔드 API 호출 경로
    const backendUrl = `https://118.67.130.71:8000/api/v1/schedule/owner-groups/all-schedules?current_user_id=${currentUserId}&days=${days}`;
    
    console.log('[API PROXY] 🚀 백엔드 호출 준비');
    console.log('[API PROXY] ✨ 최종 백엔드 URL:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    };
    
    console.log('[API PROXY] fetch 옵션 설정 완료');
    
    // Node.js 환경 변수로 SSL 검증 비활성화
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('[API PROXY] SSL 검증 비활성화 완료');
    
    let response: any;
    let usedMethod = 'default-fetch';

    try {
      console.log('[API PROXY] 🔄 기본 fetch 시작...');
      // 기본 fetch 시도
      response = await fetch(backendUrl, fetchOptions);
      console.log('[API PROXY] 기본 fetch 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY] 백엔드 응답 에러:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      console.log('[API PROXY] ✅ 기본 fetch 성공');
    } catch (fetchError) {
      console.error('[API PROXY] ❌ 기본 fetch 실패:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        console.log('[API PROXY] 🔄 node-fetch 시도...');
        try {
          response = await nodeFetch(backendUrl, {
            method: 'GET',
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
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('[API PROXY] node-fetch 응답 에러:', response.status, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          console.log('[API PROXY] ✅ node-fetch 성공');
        } catch (nodeFetchError) {
          console.error('[API PROXY] ❌ node-fetch도 실패:', nodeFetchError instanceof Error ? nodeFetchError.message : String(nodeFetchError));
          throw nodeFetchError;
        }
      } else {
        throw fetchError;
      }
    } finally {
      // SSL 검증 설정 복원
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      console.log('[API PROXY] SSL 설정 복원 완료');
    }

    const data = await response.json();
    console.log('[API PROXY] ✅ 백엔드 데이터 파싱 성공 (방법:', usedMethod + ')');
    console.log('[API PROXY] 응답 데이터 구조:', {
      hasSchedules: !!data.schedules,
      schedulesCount: data.schedules?.length || 0,
      hasOwnerGroups: !!data.ownerGroups,
      ownerGroupsCount: data.ownerGroups?.length || 0,
      totalSchedules: data.totalSchedules
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('[API PROXY] ❌ 최종 에러:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      { 
        success: false,
        message: 'Failed to fetch owner groups schedules',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 