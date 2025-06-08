import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getCurrentUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  console.log('[API PROXY] ⭐ Owner Groups All Schedules GET 요청 시작 ⭐');
  console.log('[API PROXY] 요청 URL:', request.url);
  
  try {
    // 인증 확인
    const { user, unauthorized } = requireAuth(request);
    if (unauthorized) {
      return NextResponse.json({ error: unauthorized.error }, { status: unauthorized.status });
    }
    
    const { searchParams } = new URL(request.url);
    // current_user_id는 인증된 사용자 ID 사용
    const currentUserId = getCurrentUserId(request)?.toString();
    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: '인증된 사용자 정보가 없습니다.' },
        { status: 401 }
      );
    }
    
    const days = searchParams.get('days') || '7'; // 기본 7일
    const year = searchParams.get('year'); // 년도 파라미터
    const month = searchParams.get('month'); // 월 파라미터

    console.log('[API PROXY] 파라미터 추출 완료:', { currentUserId, days, year, month });

    // 백엔드 API 호출 경로 - year와 month 파라미터 포함
    const backendParams = new URLSearchParams({
      current_user_id: currentUserId,
      days: days
    });
    
    // year와 month 파라미터가 있으면 추가
    if (year) {
      backendParams.append('year', year);
      console.log('[API PROXY] year 파라미터 추가:', year);
    }
    if (month) {
      backendParams.append('month', month);
      console.log('[API PROXY] month 파라미터 추가:', month);
    }
    
    const backendUrl = `https://118.67.130.71:8000/api/v1/schedule/owner-groups/all-schedules?${backendParams.toString()}`;
    
    console.log('[API PROXY] 🚀 백엔드 호출 준비');
    console.log('[API PROXY] ✨ 최종 백엔드 URL:', backendUrl);
    
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Next.js API Proxy',
      },
    };
    
    console.log('[API PROXY] fetch 옵션 설정 완료');
    
    // Node.js 환경 변수로 SSL 검증 비활성화
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.log('[API PROXY] SSL 검증 비활성화 완료');
    
    let response: any;

    try {
      console.log('[API PROXY] 🔄 백엔드 API 호출 시작...');
      // 기본 fetch 시도
      response = await fetch(backendUrl, fetchOptions);
      console.log('[API PROXY] 백엔드 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API PROXY] 백엔드 응답 에러:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      console.log('[API PROXY] ✅ 백엔드 호출 성공');
    } catch (fetchError) {
      console.error('[API PROXY] ❌ 백엔드 호출 실패:', fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      // SSL 검증 설정 복원
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      
      // 백엔드 연결 실패 시 에러 응답 반환
      return NextResponse.json(
        { 
          success: false,
          message: 'Backend connection failed',
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          details: '백엔드 서버 연결에 실패했습니다.'
        },
        { status: 502 }
      );
    } finally {
      // SSL 검증 설정 복원
      if (originalTlsReject !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      console.log('[API PROXY] SSL 설정 복원 완료');
    }

    const data = await response.json();
    console.log('[API PROXY] ✅ 백엔드 데이터 파싱 성공');
    console.log('[API PROXY] 응답 데이터 구조:', {
      success: data.success,
      hasData: !!data.data,
      schedulesCount: data.data?.schedules?.length || 0,
      hasQueryPeriod: !!data.data?.queryPeriod,
      queryPeriod: data.data?.queryPeriod
    });

    return NextResponse.json(data);

  } catch (error) {
    console.error('[API PROXY] ❌ 최종 에러:', error instanceof Error ? error.message : String(error));
    console.error('[API PROXY] 에러 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        success: false,
        message: 'API Proxy Error',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 