import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

// 운영 환경에서는 다른 백엔드 URL 사용
const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.BACKEND_URL || 'https://118.67.130.71:8000')  // 포트 번호 추가
  : (process.env.BACKEND_URL || 'https://118.67.130.71:8000');

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
    console.log('=== [Profile API] 요청 시작 ===');
    console.log('[Profile API] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Profile API] 환경 변수 BACKEND_URL:', process.env.BACKEND_URL);
    console.log('[Profile API] 환경 변수 NEXT_PUBLIC_BACKEND_URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
    console.log('[Profile API] 사용된 BACKEND_URL:', BACKEND_URL);
    console.log('[Profile API] 요청 URL:', request.url);
    console.log('[Profile API] 요청 헤더:', Object.fromEntries(request.headers.entries()));
    
    // JWT 토큰 검증
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('token')?.value;
    
    console.log('[Profile API] 토큰 존재 여부:', !!token);
    console.log('[Profile API] Authorization 헤더:', request.headers.get('authorization')?.substring(0, 50) + '...');
    
    if (!token) {
      console.log('[Profile API] 토큰 없음');
      return NextResponse.json(
        { success: false, message: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const decoded = verifyJWT(token);
    console.log('[Profile API] JWT 검증 결과:', !!decoded);
    
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

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    console.log('📡 백엔드 요청 시작...');
    console.log('🔧 실제 요청 URL:', `${BACKEND_URL}/api/v1/members/me`);
    
    let backendData;
    try {
      backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('📡 백엔드 응답 성공');
    } catch (fetchError) {
      console.error('❌ 백엔드 요청 실패:', fetchError);
      
      // 더 구체적인 에러 메시지 제공
      let errorMessage = '백엔드 서버에 연결할 수 없습니다.';
      if (fetchError instanceof Error) {
        if (fetchError.message.includes('fetch')) {
          errorMessage = '네트워크 연결에 실패했습니다.';
        } else if (fetchError.message.includes('timeout')) {
          errorMessage = '서버 응답 시간이 초과되었습니다.';
        } else if (fetchError.message.includes('503')) {
          errorMessage = '백엔드 서버가 일시적으로 사용할 수 없습니다.';
        }
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: errorMessage,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        },
        { status: 503 }
      );
    }
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