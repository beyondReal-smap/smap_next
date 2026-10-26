import { NextRequest, NextResponse } from 'next/server';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Member Groups API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string): Promise<any> {
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

  try {
    try {
      // 기본 fetch 시도
      response = await fetch(url, fetchOptions);
    } catch (fetchError) {
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
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
  
  try {
    console.log('[Member Groups API] ===== 멤버 그룹 조회 시작 =====');
    console.log('[Member Groups API] 멤버 ID:', memberId);
    console.log('[Member Groups API] 요청 시간:', new Date().toISOString());

    // 성공하는 멤버 API와 유사한 패턴들 시도
    const possibleUrls = [
      `https://api3.aiagnt.kr/api/v1/group-members/group/${memberId}`,
      `https://api3.aiagnt.kr/api/v1/groups/member/${memberId}`,
      `https://api3.aiagnt.kr/api/v1/member-groups/${memberId}`,
      `https://api3.aiagnt.kr/api/v1/members/${memberId}/groups`,
      `https://api3.aiagnt.kr/api/v1/group-members/member/${memberId}` // 성공하는 패턴 역순
    ];

    let groupsData = null;
    let successUrl = null;
    let lastError = null;

    for (const url of possibleUrls) {
      try {
        console.log('[Member Groups API] 🔄 백엔드 API 시도:', url);
        
        const startTime = Date.now();
        groupsData = await fetchWithFallback(url);
        const endTime = Date.now();
        
        console.log('[Member Groups API] ⏱️ 응답 시간:', endTime - startTime, 'ms');
        console.log('[Member Groups API] ✅ 백엔드 응답 성공!');
        console.log('[Member Groups API] 📊 응답 데이터 타입:', Array.isArray(groupsData) ? 'Array' : typeof groupsData);
        console.log('[Member Groups API] 📊 데이터 길이:', Array.isArray(groupsData) ? groupsData.length : 'N/A');
        
        if (Array.isArray(groupsData) && groupsData.length > 0) {
          console.log('[Member Groups API] 📋 첫 번째 그룹 샘플:', {
            sgt_idx: groupsData[0].sgt_idx,
            sgt_title: groupsData[0].sgt_title,
            sgt_code: groupsData[0].sgt_code,
            mt_idx: groupsData[0].mt_idx
          });
        }
        
        successUrl = url;
        break; // 성공하면 루프 종료
      } catch (urlError) {
        lastError = urlError;
        console.log('[Member Groups API] ❌ URL 실패:', url);
        console.log('[Member Groups API] 🔍 에러 상세:', {
          message: urlError instanceof Error ? urlError.message : String(urlError),
          name: urlError instanceof Error ? urlError.name : 'Unknown',
          code: (urlError as any)?.code || 'UNKNOWN'
        });
        continue; // 다음 URL 시도
      }
    }

    // 실제 백엔드 데이터가 있으면 그대로 반환
    if (groupsData && Array.isArray(groupsData) && groupsData.length > 0) {
      console.log('[Member Groups API] 🎯 실제 백엔드 데이터 반환!');
      console.log('[Member Groups API] 📈 그룹 수:', groupsData.length);
      console.log('[Member Groups API] 🔗 성공 URL:', successUrl);
      
      // null 값을 기본값으로 변환
      const processedData = groupsData.map((group: any) => ({
        ...group,
        sgt_show: group.sgt_show || "Y",
        sgt_content: group.sgt_content || "",
        sgt_memo: group.sgt_memo || "",
        sgt_wdate: group.sgt_wdate || new Date().toISOString(),
        memberCount: group.memberCount || group.member_count || 0
      }));
      
      console.log('[Member Groups API] ✨ 데이터 처리 완료, 클라이언트로 전송');
      
      return NextResponse.json(processedData, {
        headers: {
          'X-Data-Source': 'backend-real',
          'X-Groups-Count': processedData.length.toString(),
          'X-Backend-URL': successUrl || 'unknown',
          'X-Response-Time': new Date().toISOString()
        }
      });
    } else if (groupsData && Array.isArray(groupsData) && groupsData.length === 0) {
      console.log('[Member Groups API] ⚠️ 백엔드에서 빈 배열 반환');
      console.log('[Member Groups API] 🔗 성공 URL:', successUrl);
      
      return NextResponse.json([], {
        headers: {
          'X-Data-Source': 'backend-empty',
          'X-Groups-Count': '0',
          'X-Backend-URL': successUrl || 'unknown'
        }
      });
    } else {
      console.warn('[Member Groups API] ⚠️ 모든 백엔드 URL 실패');
      console.warn('[Member Groups API] 🔍 마지막 에러:', lastError);
      throw new Error(`모든 백엔드 엔드포인트 실패. 마지막 에러: ${lastError}`);
    }

  } catch (error) {
    console.error('[Member Groups API] ❌ 전체 프로세스 실패:', error);
    console.error('[Member Groups API] 🔍 에러 상세:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 목업 데이터 반환 (완전한 필드 포함)
    console.log('[Member Groups API] 🔄 목업 데이터로 대체');
    const mockData = [
      {
        sgt_idx: 641,
        mt_idx: parseInt(memberId),
        sgt_title: '테스트 그룹 1',
        sgt_code: 'TEST001',
        sgt_show: 'Y',
        sgt_content: '테스트용 그룹입니다.',
        sgt_memo: '첫 번째 테스트 그룹',
        sgt_wdate: '2024-05-24T01:17:50',
        memberCount: 4
      },
      {
        sgt_idx: 642,
        mt_idx: parseInt(memberId),
        sgt_title: '테스트 그룹 2',
        sgt_code: 'TEST002',
        sgt_show: 'Y',
        sgt_content: '두 번째 테스트용 그룹입니다.',
        sgt_memo: '두 번째 테스트 그룹',
        sgt_wdate: '2024-05-24T01:17:50',
        memberCount: 3
      }
    ];

    return NextResponse.json(mockData, {
      headers: {
        'X-Data-Source': 'mock-fallback',
        'X-Groups-Count': mockData.length.toString(),
        'X-Error': error instanceof Error ? error.message : String(error)
      }
    });
  }
} 