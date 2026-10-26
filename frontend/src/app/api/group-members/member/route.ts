import { NextRequest, NextResponse } from 'next/server';

async function fetchWithFallback(url: string): Promise<any> {
  const fetchOptions: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Next.js API Proxy',
    },
  };
  
  // Node.js 환경 변수로 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  try {
    const response = await fetch(url, fetchOptions);

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
  const memberId = searchParams.get('memberId');
  
  if (!memberId) {
    return NextResponse.json(
      { error: 'memberId parameter is required' },
      { status: 400 }
    );
  }
  
  try {
    console.log('[Group Members API] ===== 특정 멤버의 그룹 조회 시작 =====');
    console.log('[Group Members API] 멤버 ID:', memberId);
    console.log('[Group Members API] 요청 시간:', new Date().toISOString());

    // 백엔드 엔드포인트 호출
    const backendUrl = `https://api3.aiagnt.kr/api/v1/group-members/member/${memberId}`;
    
    console.log('[Group Members API] 🔄 백엔드 API 호출:', backendUrl);
    
    const startTime = Date.now();
    const membersData = await fetchWithFallback(backendUrl);
    const endTime = Date.now();
    
    console.log('[Group Members API] ⏱️ 응답 시간:', endTime - startTime, 'ms');
    console.log('[Group Members API] ✅ 백엔드 응답 성공!');
    console.log('[Group Members API] 📊 응답 데이터 타입:', Array.isArray(membersData) ? 'Array' : typeof membersData);
    
    return NextResponse.json(membersData, {
      headers: {
        'X-Data-Source': 'backend-real',
        'X-Backend-URL': backendUrl,
        'X-Response-Time': new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Group Members API] ❌ 백엔드 호출 실패:', error);
    console.error('[Group Members API] 🔍 에러 상세:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // 에러 발생 시 빈 배열 반환
    console.log('[Group Members API] 🔄 빈 배열 반환');
    
    return NextResponse.json([], {
      status: 200,
      headers: {
        'X-Data-Source': 'error-fallback',
        'X-Error': error instanceof Error ? error.message : String(error)
      }
    });
  }
}