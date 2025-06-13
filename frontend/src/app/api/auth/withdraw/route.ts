import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://118.67.130.71:8000';

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  // Node.js 환경 변수로 SSL 검증 비활성화
  const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  try {
    const fetchOptions: RequestInit = {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
        ...options.headers,
      },
      body: options.body,
    };

    console.log('[Withdraw API] API 호출 시작:', url);
    
    const response = await fetch(url, fetchOptions);
    
    console.log('[Withdraw API] API 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Withdraw API] API 오류 응답:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Withdraw API] API 응답 성공');
    return data;
    
  } catch (error) {
    console.error('[Withdraw API] fetch 오류:', error);
    throw error;
  } finally {
    // 환경 변수 복원
    if (originalTlsReject !== undefined) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
    } else {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reasons, etcReason } = body;

    // 기본 유효성 검사
    if (!reasons || !Array.isArray(reasons) || reasons.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: '탈퇴 사유를 선택해주세요.' 
        },
        { status: 400 }
      );
    }

    // 기타 이유 선택 시 상세 사유 필수
    if (reasons.includes('기타 이유') && (!etcReason || etcReason.trim() === '')) {
      return NextResponse.json(
        { 
          success: false, 
          message: '기타 사유를 입력해주세요.' 
        },
        { status: 400 }
      );
    }

    // Authorization 헤더 전달
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { 
          success: false, 
          message: '인증 토큰이 필요합니다.' 
        },
        { status: 401 }
      );
    }

    // 탈퇴 사유를 숫자로 매핑
    const reasonMapping: { [key: string]: number } = {
      '자주 사용하지 않아요': 1,
      '원하는 기능 부족': 2,
      '서비스가 불편해요': 3,
      '개인정보 우려': 4,
      '기타 이유': 5
    };

    // 첫 번째 선택된 사유를 기본으로 사용
    const primaryReason = reasons[0];
    const mt_retire_chk = reasonMapping[primaryReason] || 5;

    console.log('🔄 FastAPI 백엔드로 회원 탈퇴 요청 전달');
    console.log('탈퇴 사유:', reasons);
    console.log('기타 사유:', etcReason);
    console.log('매핑된 사유 번호:', mt_retire_chk);

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    const backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        mt_retire_chk,
        mt_retire_etc: etcReason || null,
        reasons: reasons,
      }),
    });

    if (backendData.success || backendData.result === 'Y') {
      console.log('✅ FastAPI 백엔드 회원 탈퇴 성공');
      
      return NextResponse.json({
        success: true,
        message: backendData.message || '회원 탈퇴가 완료되었습니다.'
      });
    } else {
      console.log('❌ FastAPI 백엔드 회원 탈퇴 실패:', backendData.message);
      
      return NextResponse.json(
        { 
          success: false, 
          message: backendData.message || '회원 탈퇴 처리에 실패했습니다.' 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ 회원 탈퇴 API 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
      },
      { status: 500 }
    );
  }
} 