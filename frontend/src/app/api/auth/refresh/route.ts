import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, generateJWT } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('[REFRESH API] 토큰 갱신 요청');

    // 현재 사용자 정보 확인
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      console.log('[REFRESH API] 유효하지 않은 토큰');
      return NextResponse.json(
        { success: false, message: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    console.log('[REFRESH API] 토큰 갱신 대상 사용자:', currentUser.mt_idx, currentUser.mt_name);

    // 새로운 JWT 토큰 생성
    const newToken = generateJWT({
      mt_idx: currentUser.mt_idx,
      mt_id: currentUser.mt_id,
      mt_name: currentUser.mt_name,
      mt_nickname: currentUser.mt_nickname,
      mt_file1: currentUser.mt_file1,
      sgt_idx: currentUser.sgt_idx,
      sgdt_idx: currentUser.sgdt_idx,
      sgdt_owner_chk: currentUser.sgdt_owner_chk,
      sgdt_leader_chk: currentUser.sgdt_leader_chk
    });

    // 응답 생성 및 쿠키에 새 토큰 저장
    const response = NextResponse.json({
      success: true,
      message: '토큰이 갱신되었습니다.',
      token: newToken
    });

    response.cookies.set('auth-token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30일 (한 달)
    });

    console.log('[REFRESH API] 토큰 갱신 성공');
    return response;

  } catch (error) {
    console.error('[REFRESH API] 토큰 갱신 오류:', error);
    return NextResponse.json(
      { success: false, message: '토큰 갱신에 실패했습니다.' },
      { status: 500 }
    );
  }
} 