import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseUrl } from '../../_utils/backend';

const BACKEND_URL = resolveBackendBaseUrl();

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
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

export async function GET(request: NextRequest) {
  try {
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

    console.log('🔄 FastAPI 백엔드로 사용자 프로필 조회 요청 전달');
    console.log('🌐 백엔드 URL:', `${BACKEND_URL}/api/v1/members/me`);

    // FastAPI 백엔드 API 호출 (fetchWithFallback 사용)
    const backendData = await fetchWithFallback(`${BACKEND_URL}/api/v1/members/me`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (backendData.success || backendData.result === 'Y') {
      console.log('✅ FastAPI 백엔드 프로필 조회 성공');
      
      return NextResponse.json({
        success: true,
        data: backendData.data,
        message: backendData.message || '프로필 조회가 성공했습니다.'
      });
    } else {
      console.log('❌ FastAPI 백엔드 프로필 조회 실패:', backendData.message);
      
      return NextResponse.json(
        { 
          success: false, 
          message: backendData.message || '프로필 조회에 실패했습니다.' 
        },
        { status: 400 }
      );
    }

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