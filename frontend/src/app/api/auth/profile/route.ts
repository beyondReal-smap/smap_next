import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'https://118.67.130.71:8000';

// node-fetch를 대안으로 사용
let nodeFetch: any = null;
try {
  nodeFetch = require('node-fetch');
} catch (e) {
  console.log('[Profile API] node-fetch 패키지를 찾을 수 없음');
}

async function fetchWithFallback(url: string, options: any = {}): Promise<any> {
  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
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
      console.log('[Profile API] 기본 fetch 성공');
    } catch (fetchError) {
      console.log('[Profile API] 기본 fetch 실패, node-fetch 시도:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (nodeFetch) {
        // node-fetch 시도
        response = await nodeFetch(url, {
          method: options.method || 'GET',
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
        console.log('[Profile API] node-fetch 성공');
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

export async function GET(request: NextRequest) {
  try {
    // JWT 토큰 검증
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;
    
    if (!token) {
      console.log('[Profile API] 토큰 없음');
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = verifyJWT(token);
    if (!decoded) {
      console.log('[Profile API] 토큰 검증 실패');
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    console.log('🔄 FastAPI 백엔드로 사용자 프로필 조회 요청 전달');
    console.log('🔑 토큰 검증 성공, 사용자 ID:', decoded.mt_idx);
    console.log('🌐 백엔드 URL:', `${BACKEND_URL}/api/v1/members/me`);
    console.log('🌐 전체 요청 URL:', `${BACKEND_URL}/api/v1/members/me`);
    console.log('🌍 환경 변수 BACKEND_URL:', process.env.BACKEND_URL);
    console.log('🔧 사용된 BACKEND_URL:', BACKEND_URL);

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    console.log('📡 백엔드 요청 시작...');
    const response = await fetch(`${BACKEND_URL}/api/v1/members/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Profile API] 백엔드 응답 오류:', response.status, response.statusText);
      return NextResponse.json(
        { success: false, message: '프로필 조회에 실패했습니다.' },
        { status: response.status }
      );
    }

    const backendData = await response.json();
    console.log('🔍 FastAPI 서버 응답:', JSON.stringify(backendData, null, 2));
    console.log('✅ FastAPI 백엔드 프로필 조회 성공');
    
    return NextResponse.json(backendData);

  } catch (error) {
    console.error('❌ 프로필 조회 API 오류:', error);
    console.error('❌ 오류 상세:', error instanceof Error ? error.message : String(error));
    console.error('❌ 오류 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        success: false, 
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 