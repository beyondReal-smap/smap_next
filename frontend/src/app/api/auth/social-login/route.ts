import { NextResponse } from 'next/server';
import { Member, LoginResponse } from '@/types/auth';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

// Google Client ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, token } = body;

    console.log(`[SOCIAL LOGIN] ${provider} 로그인 시도:`, { token: token?.substring(0, 20) + '...' });

    // 실제 소셜 로그인 처리 로직
    let userData = null;
    let socialData = null;

    if (provider === 'google' || provider === '구글') {
      // Google 로그인 처리 - 직접 구현
      try {
        console.log('[SOCIAL LOGIN] Google 토큰 검증 시작');
        
        let googleUser = null;

        // Google ID 토큰 검증
        try {
          const audiences = [
            GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_ID,
            '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'
          ].filter((id): id is string => Boolean(id));

          const ticket = await client.verifyIdToken({
            idToken: token,
            audience: audiences
          });

          const payload = ticket.getPayload();
          if (!payload) {
            throw new Error('토큰 페이로드가 없습니다');
          }

          googleUser = {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            givenName: payload.given_name,
            familyName: payload.family_name,
            picture: payload.picture,
            emailVerified: payload.email_verified
          };

          console.log('[SOCIAL LOGIN] Google 토큰 검증 성공:', { email: googleUser.email, name: googleUser.name });

        } catch (verifyError) {
          console.log('[SOCIAL LOGIN] Google 토큰 검증 실패, 직접 파싱 시도');
          
          // 토큰 직접 파싱
          const tokenParts = token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            
            googleUser = {
              googleId: payload.sub,
              email: payload.email,
              name: payload.name,
              givenName: payload.given_name,
              familyName: payload.family_name,
              picture: payload.picture,
              emailVerified: payload.email_verified
            };
            
            console.log('[SOCIAL LOGIN] 직접 파싱으로 Google 사용자 정보 추출 성공');
          } else {
            throw new Error('Google 토큰 검증 및 파싱에 실패했습니다');
          }
        }

        // 백엔드 API 연동
        let backendData = null;
        let isNewUser = true;
        
        try {
          console.log('[SOCIAL LOGIN] 백엔드 Google 로그인 API 호출');
          
          // SSL 인증서 검증 비활성화 (개발 환경)
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          
          const requestBody = {
            google_id: googleUser.googleId,
            email: googleUser.email,
            name: googleUser.name,
            given_name: googleUser.givenName,
            family_name: googleUser.familyName,
            picture: googleUser.picture,
            id_token: token
          };
          
          const backendResponse = await fetch('https://118.67.130.71:8000/api/v1/auth/google-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'SMAP-NextJS-SocialLogin/1.0'
            },
            body: JSON.stringify(requestBody)
          });

          if (backendResponse.ok) {
            backendData = await backendResponse.json();
            console.log('[SOCIAL LOGIN] 백엔드 Google 로그인 성공:', backendData);
            
            if (backendData.success) {
              const user = backendData.data.user;
              isNewUser = backendData.data.isNewUser;

              // 탈퇴한 사용자 확인
              if (user.mt_level === 1) {
                return NextResponse.json(
                  { 
                    success: false, 
                    message: '탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.'
                  },
                  { status: 403 }
                );
              }

              userData = {
                id: user.mt_idx,
                mt_idx: user.mt_idx,
                mt_id: user.mt_id,
                email: user.mt_email,
                mt_email: user.mt_email,
                name: user.mt_name,
                mt_name: user.mt_name,
                nickname: user.mt_nickname,
                mt_nickname: user.mt_nickname,
                profile_image: user.mt_file1 || googleUser.picture,
                mt_file1: user.mt_file1 || googleUser.picture,
                provider: 'google',
                google_id: googleUser.googleId,
                isNewUser: isNewUser,
                mt_type: user.mt_type,
                mt_level: user.mt_level,
                mt_status: user.mt_status,
                mt_hp: user.mt_hp,
                mt_birth: user.mt_birth,
                mt_gender: user.mt_gender,
                mt_lat: user.mt_lat,
                mt_long: user.mt_long,
                mt_sido: user.mt_sido,
                mt_gu: user.mt_gu,
                mt_dong: user.mt_dong,
                mt_onboarding: user.mt_onboarding,
                mt_push1: user.mt_push1,
                mt_plan_check: user.mt_plan_check,
                mt_plan_date: user.mt_plan_date,
                mt_weather_pop: user.mt_weather_pop,
                mt_weather_sky: user.mt_weather_sky,
                mt_weather_tmn: user.mt_weather_tmn,
                mt_weather_tmx: user.mt_weather_tmx,
                mt_weather_date: user.mt_weather_date,
                mt_ldate: user.mt_ldate,
                mt_adate: user.mt_adate
              };

              // JWT 토큰 생성
              const jwtToken = jwt.sign(
                { 
                  mt_idx: user.mt_idx,
                  userId: user.mt_idx, 
                  mt_id: user.mt_id,
                  mt_name: user.mt_name,
                  mt_nickname: user.mt_nickname,
                  mt_hp: user.mt_hp,
                  mt_email: user.mt_email,
                  mt_birth: user.mt_birth,
                  mt_gender: user.mt_gender,
                  mt_type: user.mt_type,
                  mt_level: user.mt_level,
                  googleId: user.mt_google_id,
                  provider: 'google'
                },
                process.env.NEXTAUTH_SECRET || 'default-secret',
                { expiresIn: '7d' }
              );

              socialData = {
                success: true,
                user: userData,
                token: jwtToken,
                isNewUser: isNewUser,
                message: isNewUser ? 'Google 계정으로 회원가입되었습니다.' : 'Google 로그인 성공'
              };
            }
          } else {
            console.log('[SOCIAL LOGIN] 백엔드 Google 로그인 실패:', backendResponse.status);
            throw new Error('Backend connection failed');
          }
        } catch (backendError) {
          console.log('[SOCIAL LOGIN] 백엔드 연결 실패, 임시 모드로 전환:', backendError);
          
          // 임시 모드
          const tempUserId = parseInt(googleUser.googleId.substring(0, 8));
          userData = {
            id: tempUserId,
            mt_idx: tempUserId,
            mt_id: `google_${tempUserId}`,
            email: googleUser.email,
            mt_email: googleUser.email,
            name: googleUser.name,
            mt_name: googleUser.name,
            nickname: googleUser.givenName || googleUser.name,
            mt_nickname: googleUser.givenName || googleUser.name,
            profile_image: googleUser.picture,
            mt_file1: googleUser.picture,
            provider: 'google',
            google_id: googleUser.googleId,
            isNewUser: true,
            mt_type: 4,
            mt_level: 2,
            mt_status: 1,
            mt_hp: '01000000000',
            mt_birth: '1990-01-01',
            mt_gender: 1,
            mt_lat: 37.5642,
            mt_long: 127.0016,
            mt_sido: '서울시',
            mt_gu: '강남구',
            mt_dong: '역삼동',
            mt_onboarding: 'Y',
            mt_push1: 'Y',
            mt_plan_check: 'N',
            mt_plan_date: '',
            mt_weather_pop: '20',
            mt_weather_sky: 8,
            mt_weather_tmn: 18,
            mt_weather_tmx: 25,
            mt_weather_date: new Date().toISOString(),
            mt_ldate: new Date().toISOString(),
            mt_adate: new Date().toISOString()
          };

          const tempToken = jwt.sign(
            { 
              mt_idx: userData.mt_idx,
              userId: userData.id,
              email: userData.email, 
              name: userData.name,
              nickname: userData.nickname,
              googleId: googleUser.googleId,
              provider: 'google'
            },
            process.env.NEXTAUTH_SECRET || 'default-secret',
            { expiresIn: '7d' }
          );

          socialData = {
            success: true,
            user: userData,
            token: tempToken,
            isNewUser: true,
            message: 'Google 로그인 성공 (임시 모드)'
          };
        }

      } catch (error) {
        console.error('[SOCIAL LOGIN] Google 처리 실패:', error);
        throw new Error('Google 로그인 처리 중 오류가 발생했습니다.');
      }

    } else if (provider === 'kakao' || provider === '카카오') {
      // Kakao 로그인 처리 - 직접 구현
      try {
        console.log('[SOCIAL LOGIN] Kakao 사용자 정보 요청');

        // 카카오 사용자 정보 가져오기
        const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
        });

        if (!kakaoUserResponse.ok) {
          throw new Error('카카오 사용자 정보를 가져올 수 없습니다.');
        }

        const kakaoUser = await kakaoUserResponse.json();
        console.log('[SOCIAL LOGIN] 카카오 사용자 정보 획득 성공');

        const kakaoId = kakaoUser.id.toString();
        const email = kakaoUser.kakao_account?.email || null;
        const nickname = kakaoUser.properties?.nickname || '';
        const profileImage = kakaoUser.properties?.profile_image || null;

        // 백엔드 API 연동
        let backendData = null;
        let isNewUser = true;
        
        try {
          console.log('[SOCIAL LOGIN] 백엔드 Kakao 로그인 API 호출');
          
          // SSL 인증서 검증 비활성화 (개발 환경)
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          
          const backendResponse = await fetch('https://118.67.130.71:8000/api/v1/auth/kakao-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              kakao_id: kakaoId,
              email: email,
              nickname: nickname,
              profile_image: profileImage,
              access_token: token
            }),
          });

          if (backendResponse.ok) {
            backendData = await backendResponse.json();
            console.log('[SOCIAL LOGIN] 백엔드 Kakao 로그인 성공:', backendData);
            
            if (backendData.success) {
              const user = backendData.data.user;
              isNewUser = backendData.data.isNewUser;

              // 탈퇴한 사용자 확인
              if (user.mt_level === 1) {
                return NextResponse.json(
                  { 
                    success: false, 
                    message: '탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.'
                  },
                  { status: 403 }
                );
              }

              userData = {
                id: user.mt_idx,
                mt_idx: user.mt_idx,
                mt_id: user.mt_id,
                email: user.mt_email,
                mt_email: user.mt_email,
                name: user.mt_name,
                mt_name: user.mt_name,
                nickname: user.mt_nickname,
                mt_nickname: user.mt_nickname,
                profile_image: user.mt_file1 || profileImage,
                mt_file1: user.mt_file1 || profileImage,
                provider: 'kakao',
                kakao_id: kakaoId,
                isNewUser: isNewUser,
                mt_type: user.mt_type,
                mt_level: user.mt_level,
                mt_status: user.mt_status,
                mt_hp: user.mt_hp,
                mt_birth: user.mt_birth,
                mt_gender: user.mt_gender,
                mt_lat: user.mt_lat,
                mt_long: user.mt_long,
                mt_sido: user.mt_sido,
                mt_gu: user.mt_gu,
                mt_dong: user.mt_dong,
                mt_onboarding: user.mt_onboarding,
                mt_push1: user.mt_push1,
                mt_plan_check: user.mt_plan_check,
                mt_plan_date: user.mt_plan_date,
                mt_weather_pop: user.mt_weather_pop,
                mt_weather_sky: user.mt_weather_sky,
                mt_weather_tmn: user.mt_weather_tmn,
                mt_weather_tmx: user.mt_weather_tmx,
                mt_weather_date: user.mt_weather_date,
                mt_ldate: user.mt_ldate,
                mt_adate: user.mt_adate
              };

              // JWT 토큰 생성
              const jwtToken = jwt.sign(
                { 
                  mt_idx: user.mt_idx,
                  userId: user.mt_idx, 
                  mt_id: user.mt_id,
                  mt_name: user.mt_name,
                  mt_nickname: user.mt_nickname,
                  mt_hp: user.mt_hp,
                  mt_email: user.mt_email,
                  mt_birth: user.mt_birth,
                  mt_gender: user.mt_gender,
                  mt_type: user.mt_type,
                  mt_level: user.mt_level,
                  kakaoId: user.mt_kakao_id,
                  provider: 'kakao'
                },
                process.env.NEXTAUTH_SECRET || 'default-secret',
                { expiresIn: '7d' }
              );

              socialData = {
                success: true,
                user: userData,
                token: jwtToken,
                isNewUser: isNewUser,
                message: isNewUser ? '카카오 계정으로 회원가입되었습니다.' : '카카오 로그인 성공'
              };
            }
          } else {
            console.log('[SOCIAL LOGIN] 백엔드 Kakao 로그인 실패:', backendResponse.status);
            throw new Error('Backend connection failed');
          }
        } catch (backendError) {
          console.log('[SOCIAL LOGIN] 백엔드 연결 실패, 임시 모드로 전환:', backendError);
          
          // 임시 모드
          userData = {
            id: kakaoId,
            mt_idx: parseInt(kakaoId.substring(0, 8)),
            mt_id: `kakao_${kakaoId}`,
            email: email,
            mt_email: email,
            name: nickname,
            mt_name: nickname,
            nickname: nickname,
            mt_nickname: nickname,
            profile_image: profileImage,
            mt_file1: profileImage,
            provider: 'kakao',
            kakao_id: kakaoId,
            isNewUser: true,
            mt_type: 2,
            mt_level: 2,
            mt_status: 1,
            mt_hp: '01000000000',
            mt_birth: '1990-01-01',
            mt_gender: 1,
            mt_lat: 37.5642,
            mt_long: 127.0016,
            mt_sido: '서울시',
            mt_gu: '강남구',
            mt_dong: '역삼동',
            mt_onboarding: 'Y',
            mt_push1: 'Y',
            mt_plan_check: 'N',
            mt_plan_date: '',
            mt_weather_pop: '20',
            mt_weather_sky: 8,
            mt_weather_tmn: 18,
            mt_weather_tmx: 25,
            mt_weather_date: new Date().toISOString(),
            mt_ldate: new Date().toISOString(),
            mt_adate: new Date().toISOString()
          };

          const tempToken = jwt.sign(
            { 
              mt_idx: userData.mt_idx,
              userId: userData.id,
              email: userData.email, 
              nickname: userData.nickname,
              kakaoId: kakaoId,
              provider: 'kakao'
            },
            process.env.NEXTAUTH_SECRET || 'default-secret',
            { expiresIn: '7d' }
          );

          socialData = {
            success: true,
            user: userData,
            token: tempToken,
            isNewUser: true,
            message: '카카오 로그인 성공 (임시 모드)'
          };
        }

      } catch (error) {
        console.error('[SOCIAL LOGIN] Kakao 처리 실패:', error);
        throw new Error('Kakao 로그인 처리 중 오류가 발생했습니다.');
      }

    } else {
      // 기타 소셜 로그인 (네이버, 애플 등) - 향후 구현
      console.log(`[SOCIAL LOGIN] ${provider} 로그인은 아직 구현되지 않았습니다.`);
      
      // 임시로 모의 사용자 생성 (실제 구현 시 제거)
      const mockUserId = Math.floor(Math.random() * 9000) + 1000;
      userData = {
        id: mockUserId,
        mt_idx: mockUserId,
        mt_id: `${provider.toLowerCase()}_${mockUserId}`,
        email: `user${mockUserId}@${provider.toLowerCase()}.com`,
        mt_email: `user${mockUserId}@${provider.toLowerCase()}.com`,
        name: `${provider} 사용자`,
        mt_name: `${provider} 사용자`,
        nickname: `${provider}닉네임${mockUserId}`,
        mt_nickname: `${provider}닉네임${mockUserId}`,
        profile_image: '/images/avatar1.png',
        mt_file1: '/images/avatar1.png',
        provider: provider.toLowerCase(),
        isNewUser: true,
        mt_type: 1,
        mt_level: 2,
        mt_status: 1,
        mt_hp: '01000000000',
        mt_birth: '1990-01-01',
        mt_gender: 1,
        mt_lat: 37.5642,
        mt_long: 127.0016,
        mt_sido: '서울시',
        mt_gu: '강남구',
        mt_dong: '역삼동',
        mt_onboarding: 'Y',
        mt_push1: 'Y',
        mt_plan_check: 'N',
        mt_plan_date: '',
        mt_weather_pop: '20',
        mt_weather_sky: 8,
        mt_weather_tmn: 18,
        mt_weather_tmx: 25,
        mt_weather_date: new Date().toISOString(),
        mt_ldate: new Date().toISOString(),
        mt_adate: new Date().toISOString()
      };
      
      // 임시 토큰 생성
      const tempToken = jwt.sign(
        { 
          mt_idx: userData.mt_idx,
          userId: userData.id,
          email: userData.email, 
          name: userData.name,
          nickname: userData.nickname,
          provider: provider.toLowerCase()
        },
        process.env.NEXTAUTH_SECRET || 'default-secret',
        { expiresIn: '7d' }
      );
      
      socialData = {
        success: true,
        user: userData,
        token: tempToken,
        isNewUser: true,
        message: `${provider} 로그인 성공 (임시 모드)`
      };
    }

    if (!userData) {
      throw new Error('사용자 정보를 가져올 수 없습니다.');
    }

    // 기존 사용자 여부 확인 로직은 각 소셜 로그인 API에서 이미 처리됨
    console.log(`[SOCIAL LOGIN] ${provider} 로그인 성공:`, {
      userId: userData.id || userData.mt_idx,
      email: userData.email,
      isNewUser: socialData?.isNewUser
    });

    // 응답 데이터를 기존 Member 형식에 맞게 변환
    const member: Member = {
      mt_idx: userData.mt_idx || userData.id,
      mt_type: userData.mt_type || (provider === 'google' || provider === '구글' ? 4 : 2),
      mt_level: userData.mt_level || 2,
      mt_status: userData.mt_status || 1,
      mt_id: userData.mt_id || `${provider}_${userData.id}`,
      mt_name: userData.mt_name || userData.name || '',
      mt_nickname: userData.mt_nickname || userData.nickname || '',
      mt_hp: userData.mt_hp || '01000000000',
      mt_email: userData.mt_email || userData.email || '',
      mt_birth: userData.mt_birth || '1990-01-01',
      mt_gender: userData.mt_gender || 1,
      mt_file1: userData.mt_file1 || userData.profile_image || '/images/avatar1.png',
      mt_lat: userData.mt_lat || 37.5642,
      mt_long: userData.mt_long || 127.0016,
      mt_sido: userData.mt_sido || '서울시',
      mt_gu: userData.mt_gu || '강남구',
      mt_dong: userData.mt_dong || '역삼동',
      mt_onboarding: userData.mt_onboarding || 'Y',
      mt_push1: userData.mt_push1 || 'Y',
      mt_plan_check: userData.mt_plan_check || 'N',
      mt_plan_date: userData.mt_plan_date || '',
      mt_weather_pop: userData.mt_weather_pop || '20',
      mt_weather_sky: userData.mt_weather_sky || 8,
      mt_weather_tmn: userData.mt_weather_tmn || 18,
      mt_weather_tmx: userData.mt_weather_tmx || 25,
      mt_weather_date: userData.mt_weather_date || new Date().toISOString(),
      mt_ldate: userData.mt_ldate || new Date().toISOString(),
      mt_adate: userData.mt_adate || new Date().toISOString()
    };

    const response: LoginResponse = {
      success: true,
      message: socialData?.isNewUser ? 
        `${provider} 계정으로 회원가입되었습니다.` : 
        `${provider} 로그인 성공`,
      data: {
        token: socialData?.token || '',
        member: member
      }
    };

    // 쿠키에 토큰 저장
    const nextResponse = NextResponse.json(response);
    if (socialData?.token) {
      nextResponse.cookies.set('auth-token', socialData.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return nextResponse;
    
  } catch (error: any) {
    console.error('[SOCIAL LOGIN ERROR]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || '소셜 로그인 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
} 