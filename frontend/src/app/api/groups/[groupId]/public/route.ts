import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Group Public API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: RequestInit): Promise<any> {
  // Node.js 환경 변수로 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  let response: any;

  try {
    try {
      // 기본 fetch 시도
      response = await fetch(url, options);
    } catch (fetchError) {
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          ...options,
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
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    console.log('[Group Public API] 공개 그룹 정보 조회 요청:', { groupId });

    let data = null;
    let backendUrl = '';
    
    try {
      // 방법 1: 백엔드 공개 그룹 조회 API 호출 시도
      backendUrl = `https://118.67.130.71:8000/api/v1/groups/${groupId}/public`;
      console.log('[Group Public API] 방법 1 - 공개 API 호출:', backendUrl);
      
      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Next.js API Proxy',
          'Content-Type': 'application/json',
        },
        // @ts-ignore - Next.js 환경에서 SSL 인증서 검증 우회
        rejectUnauthorized: false,
      };
      
      const publicData = await fetchWithFallback(backendUrl, fetchOptions);
      
      if (publicData && publicData.success && publicData.data) {
        data = publicData.data;
        console.log('[Group Public API] 방법 1 성공:', data);
      }
    } catch (publicError) {
      console.log('[Group Public API] 방법 1 실패:', publicError);
    }
    
    if (!data) {
      try {
        // 방법 2: 일반 그룹 조회 API 호출 시도
        backendUrl = `https://118.67.130.71:8000/api/v1/groups/${groupId}`;
        console.log('[Group Public API] 방법 2 - 일반 그룹 API 호출:', backendUrl);
        
        const fetchOptions: RequestInit = {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Next.js API Proxy',
            'Content-Type': 'application/json',
          },
          // @ts-ignore
          rejectUnauthorized: false,
        };
        
        data = await fetchWithFallback(backendUrl, fetchOptions);
        console.log('[Group Public API] 방법 2 성공:', data);
      } catch (generalError) {
        console.log('[Group Public API] 방법 2 실패:', generalError);
      }
    }
    
    if (!data) {
      throw new Error(`그룹 ID ${groupId}를 찾을 수 없습니다.`);
    }
    
    // 멤버 수 정확히 조회
    let memberCount = 0;
    try {
      const memberUrl = `https://118.67.130.71:8000/api/v1/group-members/member/${groupId}`;
      console.log('[Group Public API] 멤버 수 조회:', memberUrl);
      
      const memberResponse = await fetchWithFallback(memberUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Next.js API Proxy',
          'Content-Type': 'application/json',
        },
        // @ts-ignore
        rejectUnauthorized: false,
      });
      
      if (Array.isArray(memberResponse)) {
        memberCount = memberResponse.length;
      } else if (memberResponse && Array.isArray(memberResponse.data)) {
        memberCount = memberResponse.data.length;
      }
      
      console.log('[Group Public API] 멤버 수 조회 성공:', memberCount);
    } catch (memberError) {
      console.log('[Group Public API] 멤버 수 조회 실패:', memberError);
      // 멤버 수 조회 실패 시 기본값 0 사용
      memberCount = 0;
    }
    
    console.log('[Group Public API] 최종 데이터:', data);
    
    // 공개 정보만 포함한 그룹 데이터 반환
    const publicGroupData = {
      sgt_idx: data.sgt_idx,
      sgt_title: data.sgt_title,
      sgt_content: data.sgt_content || data.sgt_memo,
      sgt_memo: data.sgt_memo,
      sgt_show: data.sgt_show,
      sgt_wdate: data.sgt_wdate,
      memberCount: memberCount
    };
    
    return NextResponse.json({
      success: true,
      data: publicGroupData
    });
    
  } catch (error) {
    console.error('[Group Public API] 오류:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch group information',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 