import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * 현재 로그인된 사용자의 정보 조회
 * GET /api/members/me
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Current User API] 현재 사용자 정보 조회 요청');
    
    // 현재 로그인된 사용자 확인
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      console.log('[Current User API] 로그인되지 않음');
      return NextResponse.json(
        { success: false, message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log('[Current User API] 현재 사용자:', currentUser.mt_idx, currentUser.mt_name);

    // 백엔드에서 최신 사용자 정보 조회
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/members/${currentUser.mt_idx}`;
    console.log('[Current User API] 백엔드 요청:', backendUrl);

    // SSL 인증서 문제 해결을 위한 설정
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Current User API] 백엔드 응답 오류:', response.status, response.statusText);
      
      // 백엔드에서 오류가 발생한 경우 현재 저장된 사용자 정보 반환
      console.log('[Current User API] 저장된 사용자 정보로 대체 응답');
      return NextResponse.json({
        success: true,
        data: {
          mt_idx: currentUser.mt_idx,
          mt_name: currentUser.mt_name || '사용자',
          mt_id: currentUser.mt_id || '',
          mt_nickname: currentUser.mt_nickname || '',
          mt_file1: currentUser.mt_file1 || '',
          // 기본값들
          mt_email: '',
          mt_hp: '',
          mt_lat: 37.5642,
          mt_long: 127.0016,
          mt_sido: '',
          mt_gu: '',
          mt_gender: 1,
          mt_weather_sky: 8,
          mt_weather_tmx: 25,
        }
      });
    }

    const userData = await response.json();
    console.log('[Current User API] 백엔드 응답 성공:', userData);

    return NextResponse.json({
      success: true,
      data: userData
    });

  } catch (error) {
    console.error('[Current User API] 오류:', error);
    
    // 에러가 발생한 경우 저장된 사용자 정보로 대체 응답
    const currentUser = getCurrentUser(request);
    if (currentUser) {
      console.log('[Current User API] 오류 발생, 저장된 사용자 정보로 대체 응답');
      return NextResponse.json({
        success: true,
        data: {
          mt_idx: currentUser.mt_idx,
          mt_name: currentUser.mt_name || '사용자',
          mt_id: currentUser.mt_id || '',
          mt_nickname: currentUser.mt_nickname || '',
          mt_file1: currentUser.mt_file1 || '',
          // 기본값들
          mt_email: '',
          mt_hp: '',
          mt_lat: 37.5642,
          mt_long: 127.0016,
          mt_sido: '',
          mt_gu: '',
          mt_gender: 1,
          mt_weather_sky: 8,
          mt_weather_tmx: 25,
        }
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : '사용자 정보 조회 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 