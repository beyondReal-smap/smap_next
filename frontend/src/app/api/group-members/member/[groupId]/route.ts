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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  
  try {
    console.log('[Group Members API] ===== 그룹 멤버 조회 시작 =====');
    console.log('[Group Members API] 그룹 ID:', groupId);
    console.log('[Group Members API] 요청 시간:', new Date().toISOString());

    // 정확한 백엔드 엔드포인트 사용
    const backendUrl = `https://api3.aiagnt.kr/api/v1/group-members/member/${groupId}`;
    
    console.log('[Group Members API] 🔄 백엔드 API 호출:', backendUrl);
    
    const startTime = Date.now();
    const membersData = await fetchWithFallback(backendUrl);
    const endTime = Date.now();
    
    console.log('[Group Members API] ⏱️ 응답 시간:', endTime - startTime, 'ms');
    console.log('[Group Members API] ✅ 백엔드 응답 성공!');
    console.log('[Group Members API] 📊 응답 데이터 타입:', Array.isArray(membersData) ? 'Array' : typeof membersData);
    console.log('[Group Members API] 📊 데이터 길이:', Array.isArray(membersData) ? membersData.length : 'N/A');
    
    if (Array.isArray(membersData) && membersData.length > 0) {
      console.log('[Group Members API] 📋 첫 번째 멤버 샘플:', {
        mt_idx: membersData[0].mt_idx,
        mt_name: membersData[0].mt_name,
        sgdt_owner_chk: membersData[0].sgdt_owner_chk,
        sgdt_leader_chk: membersData[0].sgdt_leader_chk
      });
    }
    
    console.log('[Group Members API] ✨ 데이터 처리 완료, 클라이언트로 전송');
    
    return NextResponse.json(membersData, {
      headers: {
        'X-Data-Source': 'backend-real',
        'X-Members-Count': Array.isArray(membersData) ? membersData.length.toString() : '0',
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
        'X-Members-Count': '0',
        'X-Error': error instanceof Error ? error.message : String(error)
      }
    });
  }
} 