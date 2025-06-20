import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { pool } from '../../../lib/db';

export async function POST(request: NextRequest) {
  console.log('[KAKAO API] POST 요청 시작');
  try {
    const body = await request.json();
    console.log('[KAKAO API] 요청 본문:', body);
    const { access_token } = body;

    if (!access_token) {
      console.log('[KAKAO API] 액세스 토큰이 없음');
      return NextResponse.json(
        { error: '액세스 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('[KAKAO API] 카카오 사용자 정보 요청 시작');

    // 카카오 사용자 정보 가져오기
    const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!kakaoUserResponse.ok) {
      console.log('[KAKAO API] 카카오 사용자 정보 요청 실패:', kakaoUserResponse.status, kakaoUserResponse.statusText);
      const errorText = await kakaoUserResponse.text();
      console.log('[KAKAO API] 카카오 오러 응답:', errorText);
      return NextResponse.json(
        { error: '카카오 사용자 정보를 가져올 수 없습니다.' },
        { status: 400 }
      );
    }

    const kakaoUser = await kakaoUserResponse.json();
    console.log('[KAKAO API] 카카오 사용자 정보:', kakaoUser);
    
    const kakaoId = kakaoUser.id.toString();
    const email = kakaoUser.kakao_account?.email || null;
    const nickname = kakaoUser.properties?.nickname || '';
    const profileImage = kakaoUser.properties?.profile_image || null;

    console.log('[KAKAO API] 데이터베이스에서 기존 사용자 확인 시작 - 카카오 ID:', kakaoId);

    // 데이터베이스에서 기존 사용자 확인 (카카오 ID로 먼저 확인, 없으면 이메일로 확인)
    let existingUser = null;
    let isNewUser = false;

    try {
      // 1. 카카오 ID로 기존 사용자 확인
      const [kakaoRows] = await pool.execute(
        'SELECT * FROM member_t WHERE mt_kakao_id = ? AND mt_status = "Y"',
        [kakaoId]
      );

      if (Array.isArray(kakaoRows) && kakaoRows.length > 0) {
        existingUser = kakaoRows[0];
        console.log('[KAKAO API] 카카오 ID로 기존 사용자 발견:', existingUser.mt_idx);
      } else if (email) {
        // 2. 이메일로 기존 사용자 확인 (카카오 ID가 없는 경우)
        const [emailRows] = await pool.execute(
          'SELECT * FROM member_t WHERE mt_email = ? AND mt_status = "Y"',
          [email]
        );

        if (Array.isArray(emailRows) && emailRows.length > 0) {
          existingUser = emailRows[0];
          console.log('[KAKAO API] 이메일로 기존 사용자 발견, 카카오 ID 업데이트:', existingUser.mt_idx);
          
          // 기존 사용자에게 카카오 ID 추가
          await pool.execute(
            'UPDATE member_t SET mt_kakao_id = ?, mt_udate = NOW() WHERE mt_idx = ?',
            [kakaoId, existingUser.mt_idx]
          );
          existingUser.mt_kakao_id = kakaoId;
        }
      }

      if (!existingUser) {
        console.log('[KAKAO API] 신규 사용자 - 임시 사용자 정보 생성');
        isNewUser = true;
        
        // 신규 사용자용 임시 사용자 정보 생성
        existingUser = {
          mt_idx: null,
          mt_email: email,
          mt_nickname: nickname,
          mt_name: '',
          mt_profile_image: profileImage,
          mt_kakao_id: kakaoId,
          provider: 'kakao',
          isNewUser: true
        };
      } else {
        console.log('[KAKAO API] 기존 사용자 로그인 성공');
        isNewUser = false;
      }

    } catch (dbError) {
      console.error('[KAKAO API] 데이터베이스 조회 오류:', dbError);
      return NextResponse.json(
        { error: '사용자 확인 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    // 사용자 정보 구성
    const user = {
      mt_idx: existingUser.mt_idx,
      mt_email: existingUser.mt_email || email,
      mt_nickname: existingUser.mt_nickname || nickname,
      mt_name: existingUser.mt_name || '',
      mt_profile_image: existingUser.mt_profile_image || profileImage,
      mt_kakao_id: kakaoId,
      provider: 'kakao',
    };

    // JWT 토큰 생성 (신규 사용자는 임시 토큰)
    const tokenPayload = isNewUser 
      ? { kakaoId, email, nickname, isNewUser: true, provider: 'kakao' }
      : { userId: user.mt_idx, email: user.mt_email, nickname: user.mt_nickname, isNewUser: false };

    const token = jwt.sign(
      tokenPayload,
      process.env.NEXTAUTH_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    console.log('[KAKAO API] 사용자 정보 구성 완료:', { ...user, isNewUser });
    console.log('[KAKAO API] JWT 토큰 생성 완료');

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      user,
      token,
      isNewUser, // 🔥 신규회원 여부 추가
      socialLoginData: isNewUser ? {
        provider: 'kakao',
        kakao_id: kakaoId,
        email: email,
        nickname: nickname,
        profile_image: profileImage
      } : null
    });

    // 쿠키에 토큰 저장
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/',
    });

    console.log('[KAKAO API] 로그인 성공, 응답 반환 - isNewUser:', isNewUser);
    return response;

  } catch (error) {
    console.error('카카오 로그인 오류:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 로그아웃 처리
export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true, message: '로그아웃 되었습니다.' });
    
    // 쿠키 삭제
    response.cookies.delete('auth-token');
    
    return response;
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 