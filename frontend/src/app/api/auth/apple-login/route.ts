import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userIdentifier, userName, email, identityToken, authorizationCode } = await request.json();

    console.log('🍎 [API] Apple 로그인 요청:', {
      userIdentifier,
      userName,
      email: email || 'private',
      hasIdentityToken: !!identityToken,
      hasAuthorizationCode: !!authorizationCode
    });

    // 개발 단계: identityToken이 없더라도 회원가입 플로우로 유도 (백엔드 연동 전 임시 처리)
    // 실제 운영에서는 Apple 공개키로 JWT 검증 필수

    // 데모/개발 모드: Apple 로그인을 성공으로 처리
    const demoUser = {
      mt_idx: Math.floor(Math.random() * 9000) + 1000, // 랜덤 사용자 ID
      mt_id: userIdentifier,
      mt_name: userName || 'Apple 사용자',
      mt_nickname: userName || 'Apple 사용자',
      mt_email: email || `apple_${userIdentifier.slice(0, 8)}@privaterelay.appleid.com`,
      mt_file1: '', // Apple 로그인은 프로필 이미지 제공 안함
      mt_gender: null,
      apple_id: userIdentifier,
      provider: 'apple'
    };

    // 임시: 항상 신규 가입 플로우로 유도 (토큰 발급 없음 → 홈 이동 시 백엔드 호출 422 방지)
    return NextResponse.json({
      success: true,
      message: '신규 Apple 사용자입니다.',
      data: {
        isNewUser: true,
        user: demoUser,
        token: null
      }
    });

  } catch (error) {
    console.error('🍎 [API] Apple 로그인 오류:', error);
    return NextResponse.json({
      success: false,
      message: 'Apple 로그인 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
