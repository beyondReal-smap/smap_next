import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://api3.smap.site';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Update Contact API] node-fetch 패키지를 찾을 수 없음');
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
      console.log('[Update Contact API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Update Contact API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
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
        console.log('[Update Contact API] node-fetch 성공');
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
    const { mt_hp, mt_email } = body;

    // 기본 유효성 검사
    if (!mt_hp || !mt_email) {
      return NextResponse.json(
        { 
          success: false, 
          message: '전화번호와 이메일을 모두 입력해주세요.' 
        },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(mt_email)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '올바른 이메일 형식을 입력해주세요.' 
        },
        { status: 400 }
      );
    }

    // 전화번호 형식 검증
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    if (!phoneRegex.test(mt_hp)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)' 
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

    console.log('🔄 FastAPI 백엔드로 연락처 업데이트 요청 전달');

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    const backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/update-contact`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        mt_hp,
        mt_email,
      }),
    });

    console.log('🔍 FastAPI 서버 응답:', JSON.stringify(backendData, null, 2));

    if (backendData.success || backendData.result === 'Y') {
      console.log('✅ FastAPI 백엔드 연락처 업데이트 성공');
      
      return NextResponse.json({
        success: true,
        message: backendData.message || '연락처가 성공적으로 업데이트되었습니다.'
      });
    } else {
      console.log('❌ FastAPI 백엔드 연락처 업데이트 실패:', backendData.message);
      console.log('❌ 전체 응답 데이터:', JSON.stringify(backendData, null, 2));
      
      return NextResponse.json(
        { 
          success: false, 
          message: backendData.message || '연락처 업데이트에 실패했습니다.' 
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ 연락처 업데이트 API 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
      },
      { status: 500 }
    );
  }
} 