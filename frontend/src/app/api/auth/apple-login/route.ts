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

    // Apple Identity Token 검증 (실제 구현에서는 Apple의 공개 키로 JWT 검증)
    if (!identityToken) {
      return NextResponse.json({
        success: false,
        message: 'Apple Identity Token이 필요합니다.'
      }, { status: 400 });
    }

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

    // 실제 구현에서는 여기서 데이터베이스 조회/생성
    const isNewUser = Math.random() > 0.5; // 데모용 랜덤

    if (isNewUser) {
      // 신규 사용자
      return NextResponse.json({
        success: true,
        message: '신규 Apple 사용자입니다.',
        data: {
          isNewUser: true,
          user: demoUser,
          token: null
        }
      });
    } else {
      // 기존 사용자
      const mockToken = `apple-jwt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return NextResponse.json({
        success: true,
        message: 'Apple 로그인 성공',
        data: {
          isNewUser: false,
          user: demoUser,
          token: mockToken
        }
      });
    }

  } catch (error) {
    console.error('🍎 [API] Apple 로그인 오류:', error);
    return NextResponse.json({
      success: false,
      message: 'Apple 로그인 처리 중 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
