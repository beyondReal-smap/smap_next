import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api3.smap.site';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Change Password API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  const fetchOptions: RequestInit = {
    method: options.method || 'POST',
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
      console.log('[Change Password API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Change Password API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          method: options.method || 'POST',
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
        console.log('[Change Password API] node-fetch 성공');
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 기본 유효성 검사
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { 
          success: false, 
          message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' 
        },
        { status: 400 }
      );
    }

    // 비밀번호 강도 검사
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '새 비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다.' 
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

    console.log('🔄 FastAPI 백엔드로 비밀번호 변경 요청 전달');

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    const backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/change-password`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    console.log('🔍 FastAPI 서버 응답:', JSON.stringify(backendData, null, 2));

    if (backendData.success || backendData.result === 'Y') {
      console.log('✅ FastAPI 백엔드 비밀번호 변경 성공');
      
      return NextResponse.json({
        success: true,
        message: backendData.message || '비밀번호가 성공적으로 변경되었습니다.'
      });
    } else {
      console.log('❌ FastAPI 백엔드 비밀번호 변경 실패:', backendData.message);
      console.log('❌ 전체 응답 데이터:', JSON.stringify(backendData, null, 2));
      
      return NextResponse.json(
        { 
          success: false, 
          message: backendData.message || '비밀번호 변경에 실패했습니다.' 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ 비밀번호 변경 API 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
      },
      { status: 500 }
    );
  }
} 