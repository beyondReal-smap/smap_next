import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';

// Google Client ID (iOS 로그에서 확인된 값)
// 동적 Google Client ID (서버 사이드에서는 환경변수 우선)
// 서버 검증 기준으로 사용할 기본 Web Client ID (Android에서도 이 ID로 ID 토큰을 요청함)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 
                         process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 
                         process.env.GOOGLE_WEB_CLIENT_ID ||
                         '283271180972-02ajuasfuecajd0holgu7iqb5hvtjgbp.apps.googleusercontent.com';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// iOS 로그 전송 함수 (서버사이드)
const sendLogToConsole = (level: 'info' | 'error' | 'warning', message: string, data?: any) => {
  const logMessage = `[GOOGLE API ${level.toUpperCase()}] ${message}`;
  console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
};

export async function POST(request: NextRequest) {
  sendLogToConsole('info', 'POST 요청 시작');
  sendLogToConsole('info', '환경 변수 확인', {
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdLength: process.env.GOOGLE_CLIENT_ID?.length || 0,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    usingClientId: GOOGLE_CLIENT_ID
  });
  
  try {
    const body = await request.json();
    sendLogToConsole('info', '요청 본문 분석', {
      bodyType: typeof body,
      bodyKeys: Object.keys(body || {}),
      hasIdToken: !!body?.idToken,
      hasId_token: !!body?.id_token,
      idTokenLength: body?.idToken?.length || 0,
      id_tokenLength: body?.id_token?.length || 0,
      hasUserInfo: !!body?.userInfo,
      userInfoType: typeof body?.userInfo,
      fullBody: body
    });

    // 🚨 프론트엔드에서 전송되는 실제 필드 이름 확인
    const idToken = body.idToken || body.id_token;
    const userInfo = body.userInfo || body.user_info;

    if (!idToken) {
      sendLogToConsole('error', 'ID 토큰이 없음');
      return NextResponse.json(
        { error: 'ID 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    sendLogToConsole('info', 'ID 토큰 확인 완료', { tokenLength: idToken.length });

    sendLogToConsole('info', 'Google ID 토큰 검증 시작');
    sendLogToConsole('info', '검증 설정', {
      clientId: GOOGLE_CLIENT_ID,
      tokenPrefix: idToken.substring(0, 50) + '...'
    });

    // Google ID 토큰 검증
    let googleUser;
    try {
      sendLogToConsole('info', 'OAuth2Client.verifyIdToken 호출 중');
      
      // ID 토큰에서 audience 확인 (디버깅용)
      try {
        const tokenParts = idToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          sendLogToConsole('info', 'ID 토큰 payload 정보', {
            aud: payload.aud,
            iss: payload.iss,
            expectedAudience: GOOGLE_CLIENT_ID,
            audienceMatch: payload.aud === GOOGLE_CLIENT_ID
          });
        }
      } catch (decodeError) {
        sendLogToConsole('warning', 'ID 토큰 디코딩 실패', { error: String(decodeError) });
      }
      
      // 여러 Client ID로 검증 시도 (더 많은 가능성 추가)
      let ticket;
      const possibleAudiences = [
        // 우선 순위: 서버(Web) 클라이언트 ID
        GOOGLE_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_ID,
        // iOS 클라이언트 ID (iOS 네이티브에서 발급된 토큰 대비)
        '283271180972-i0a3sa543o61ov4uoegg0thv1fvc8fvm.apps.googleusercontent.com'
      ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);
      
      sendLogToConsole('info', '가능한 audience 목록', possibleAudiences);
      
      let verificationError;
      for (const audience of possibleAudiences) {
        try {
          sendLogToConsole('info', `audience로 검증 시도: ${audience}`);
          ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: audience,
          });
          sendLogToConsole('info', `✅ 검증 성공 - audience: ${audience}`);
          break; // 성공하면 루프 종료
        } catch (err) {
          sendLogToConsole('warning', `❌ 검증 실패 - audience: ${audience}`, {
            error: err instanceof Error ? err.message : String(err)
          });
          verificationError = err;
        }
      }
      
      if (!ticket) {
        throw verificationError || new Error('모든 audience로 검증 실패');
      }
      
      sendLogToConsole('info', '토큰 검증 완료, payload 추출 중');
      const payload = ticket.getPayload();
      
      if (!payload) {
        sendLogToConsole('error', 'payload가 null/undefined');
        throw new Error('Invalid token payload');
      }

      sendLogToConsole('info', 'payload 내용', {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        aud: payload.aud,
        iss: payload.iss,
        exp: payload.exp,
        iat: payload.iat
      });

      googleUser = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        givenName: payload.given_name,
        familyName: payload.family_name,
        picture: payload.picture,
        emailVerified: payload.email_verified
      };

      sendLogToConsole('info', 'Google 토큰 검증 성공', googleUser);
    } catch (error) {
      sendLogToConsole('error', 'Google 토큰 검증 실패', {
        errorType: typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Google 토큰 검증에 실패했습니다.',
        },
        { status: 401 }
      );
    }

    // 백엔드 API 시도 (실패해도 계속 진행)
    let backendData = null;
    let isNewUser = true;
    
    try {
      sendLogToConsole('info', '백엔드 연결 시도 시작', {
        backendUrl: 'https://api3.aiagnt.kr/api/v1/auth/google-login',
        googleUserId: googleUser.googleId,
        googleUserEmail: googleUser.email
      });
      
      const requestBody: any = {
        // 기본 구글 정보
        google_id: String(googleUser.googleId), // 문자열로 명시적 변환
        email: googleUser.email,
        name: googleUser.name,
        given_name: googleUser.givenName,
        family_name: googleUser.familyName,
        image: googleUser.picture, // 백엔드에서 image 필드를 기대함
        id_token: idToken,
        
        // 🔧 member_t 테이블 이메일 검색 설정
        lookup_strategy: 'member_t_email_search', // member_t 테이블 이메일 검색
        search_by_email: true, // 이메일로 기존 사용자 검색
        search_by_google_id: true, // 구글 ID로도 검색
        verify_email_match: true, // 이메일 일치 확인
        force_db_lookup: true, // DB 강제 조회
        table_name: 'member_t', // 검색할 테이블 명시
        email_field: 'mt_email', // 검색할 이메일 필드 명시
        search_priority: 'email_first' // 이메일 우선 검색
      };
      
      // 🔧 member_t 테이블 이메일 검색 요청
      sendLogToConsole('info', '🔧 member_t 테이블 이메일 검색 설정', {
        email: googleUser.email,
        googleId: googleUser.googleId,
        table: 'member_t',
        emailField: 'mt_email',
        action: 'member_t_email_lookup'
      });
      
      // 백엔드에 member_t 테이블 이메일 검색 요청
      requestBody.member_t_email_lookup = true;
      requestBody.lookup_priority = 'email_first'; // 이메일 우선 조회
      requestBody.debug_mode = true; // 디버그 모드 활성화
      requestBody.sql_query_hint = 'SELECT * FROM member_t WHERE mt_email = ?'; // SQL 힌트
      
      sendLogToConsole('info', '백엔드 요청 본문', requestBody);
      
      // 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
      
      const backendResponse = await fetch('https://api3.aiagnt.kr/api/v1/auth/google-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SMAP-NextJS-GoogleAuth/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // 성공 시 타임아웃 클리어

      sendLogToConsole('info', '백엔드 응답 상태', {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        ok: backendResponse.ok,
        headers: Object.fromEntries(backendResponse.headers.entries())
      });

      if (backendResponse.ok) {
        const responseText = await backendResponse.text();
        sendLogToConsole('info', '백엔드 응답 텍스트', { responseText });
        
        try {
          backendData = JSON.parse(responseText);
          sendLogToConsole('info', '백엔드 JSON 파싱 성공', backendData);
          
          // 🔍 백엔드 응답 구조 완전 분석
          sendLogToConsole('info', '🔍 백엔드 응답 전체 구조 분석', {
            success: backendData.success,
            message: backendData.message,
            data: backendData.data,
            hasData: !!backendData.data,
            hasAdditionalData: !!backendData.data?.additional_data || !!backendData.data?.additionalData,
            hasGroups: !!backendData.data?.groups,
            hasSchedules: !!backendData.data?.recent_schedules || !!backendData.data?.schedules,
            groupCount: backendData.data?.group_count,
            scheduleCount: backendData.data?.schedule_count,
            hasUser: !!backendData.data?.user || !!backendData.data?.member,
            userEmail: backendData.data?.user?.mt_email || backendData.data?.member?.mt_email,
            dataKeys: backendData.data ? Object.keys(backendData.data) : []
          });
          
          // 백엔드 응답 상세 분석
          sendLogToConsole('info', '백엔드 응답 상세 분석', {
            success: backendData.success,
            message: backendData.message,
            isNewUser: backendData.data?.is_new_user,
            userEmail: backendData.data?.member?.mt_email || backendData.data?.user?.mt_email,
            requestEmail: googleUser.email,
            foundUser: backendData.data?.member || backendData.data?.user,
            lookupMethod: backendData.data?.lookup_method || 'unknown',
            searchResults: backendData.data?.search_results || 'none'
          });
          
        } catch (jsonError) {
          sendLogToConsole('error', 'JSON 파싱 실패', { 
            error: String(jsonError),
            responseText: responseText.substring(0, 500) 
          });
          throw new Error(`JSON 파싱 실패: ${String(jsonError)}`);
        }
      } else {
        const errorText = await backendResponse.text();
        sendLogToConsole('error', '백엔드 HTTP 오류', {
          status: backendResponse.status,
          statusText: backendResponse.statusText,
          errorBody: errorText.substring(0, 500)
        });
        throw new Error(`Backend HTTP Error: ${backendResponse.status} - ${errorText}`);
      }
    } catch (backendError) {
      sendLogToConsole('error', '백엔드 연결 실패 상세', {
        errorType: typeof backendError,
        errorMessage: backendError instanceof Error ? backendError.message : String(backendError),
        errorStack: backendError instanceof Error ? backendError.stack : 'No stack',
        isNetworkError: backendError instanceof TypeError,
        isFetchError: String(backendError).includes('fetch'),
        requestedEmail: googleUser.email,
        requestedGoogleId: googleUser.googleId,
        backendUrl: 'https://api3.aiagnt.kr/api/v1/auth/google-login'
      });
      
      // 네트워크 오류인 경우 추가 정보
      if (backendError instanceof TypeError && String(backendError).includes('fetch')) {
        sendLogToConsole('error', '네트워크 연결 불가 - DNS, 방화벽, 서버 상태 확인 필요', {
          possibleCauses: [
            'SSL 인증서 문제',
            '백엔드 서버 다운',
            '방화벽 차단',
            'CORS 정책 문제'
          ]
        });
      }
      
      sendLogToConsole('warning', '백엔드 연결 실패로 임시 모드로 전환', {
        willCreateTempUser: true,
        tempUserId: parseInt(googleUser.googleId.substring(0, 8))
      });
    }

    // 백엔드 연결 성공 시
    if (backendData && backendData.success) {
      sendLogToConsole('info', '백엔드 연동 성공!', {
        hasData: !!backendData.data,
        hasUser: !!backendData.data?.user,
        hasMember: !!backendData.data?.member,
        isNewUser: !!backendData.data?.isNewUser,
        lookupMethod: backendData.data?.lookup_method
      });
      
      let user = backendData.data.user || backendData.data.member;
      isNewUser = backendData.data.isNewUser || backendData.data.is_new_user || false;
      
      // 백엔드 응답에 따른 정확한 신규/기존 사용자 판별
      sendLogToConsole('info', '백엔드 응답에 따른 사용자 구분', {
        originalIsNewUser: backendData.data?.isNewUser,
        originalIsNewUserAlt: backendData.data?.is_new_user,
        finalIsNewUser: isNewUser,
        hasUserData: !!user,
        userMtIdx: user?.mt_idx
      });
      
      // 🔧 백엔드 응답에 따른 신규/기존 사용자 판별 (백엔드 신뢰)
      if (backendData.data?.isNewUser !== undefined) {
        // 백엔드에서 명시적으로 isNewUser를 반환한 경우
        isNewUser = backendData.data.isNewUser;
        sendLogToConsole('info', '🔧 백엔드 isNewUser 값 사용', {
          backendIsNewUser: backendData.data.isNewUser,
          finalIsNewUser: isNewUser,
          reason: 'backend_explicit_value'
        });
      } else if (backendData.data?.is_new_user !== undefined) {
        // 백엔드에서 is_new_user로 반환한 경우
        isNewUser = backendData.data.is_new_user;
        sendLogToConsole('info', '🔧 백엔드 is_new_user 값 사용', {
          backendIsNewUser: backendData.data.is_new_user,
          finalIsNewUser: isNewUser,
          reason: 'backend_alt_field'
        });
      } else if (user && user.mt_idx && user.mt_idx > 0) {
        // 백엔드에서 유효한 사용자 데이터를 반환한 경우 = 기존 사용자
        isNewUser = false;
        sendLogToConsole('info', '🔧 기존 사용자 확인됨 (mt_idx 기반)', {
          mt_idx: user.mt_idx,
          mt_email: user.mt_email,
          mt_google_id: user.mt_google_id,
          reason: 'valid_user_data_with_mt_idx'
        });
      } else {
        // 백엔드에서 유효한 사용자 데이터를 반환하지 않은 경우 = 신규 사용자
        isNewUser = true;
        sendLogToConsole('info', '🔧 신규 사용자로 판별됨', {
          email: googleUser.email,
          googleId: googleUser.googleId,
          reason: user ? 'no_valid_mt_idx' : 'no_user_data',
          userMtIdx: user?.mt_idx,
          hasUser: !!user
        });
        
        // 신규 사용자용 임시 데이터 생성
        user = {
          mt_idx: null, // 신규 사용자는 mt_idx가 없음
          mt_email: googleUser.email,
          mt_name: googleUser.name,
          mt_nickname: googleUser.givenName || googleUser.name,
          mt_google_id: googleUser.googleId,
          profile_image: googleUser.picture
        };
      }

      
      // 🔧 백엔드 응답 검증 및 로깅
      sendLogToConsole('info', '🔧 백엔드 응답 사용자 정보 확인', {
        email: googleUser.email,
        backendUser: user ? {
          mt_idx: user.mt_idx,
          mt_email: user.mt_email,
          mt_name: user.mt_name,
          mt_google_id: user.mt_google_id
        } : null,
        isNewUser: isNewUser,
        emailMatch: user?.mt_email === googleUser.email,
        googleIdMatch: user?.mt_google_id === googleUser.googleId
      });
      
      
      // 이메일이 일치하지 않는 경우 경고 및 추가 조회 시도
      if (user && user.mt_email !== googleUser.email) {
        sendLogToConsole('warning', '⚠️ 이메일 불일치 감지 - 추가 조회 시도', {
          requestedEmail: googleUser.email,
          backendEmail: user.mt_email,
          userId: user.mt_idx,
          action: 'trying_direct_email_lookup'
        });
        
        // 🔧 member_t 테이블에서 이메일로 직접 사용자 조회 시도
        try {
          sendLogToConsole('info', '🔍 member_t 테이블 이메일 기반 직접 사용자 조회 시도', {
            email: googleUser.email,
            table: 'member_t',
            field: 'mt_email'
          });
          
          const emailLookupResponse = await fetch(`https://api3.aiagnt.kr/api/v1/auth/find-user-by-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'SMAP-NextJS-GoogleAuth/1.0'
            },
            body: JSON.stringify({
              email: googleUser.email,
              provider: 'google',
              force_lookup: true,
              debug_mode: true,
              table_name: 'member_t',
              email_field: 'mt_email',
              sql_query: 'SELECT * FROM member_t WHERE mt_email = ?',
              search_method: 'direct_email_lookup'
            })
          });
          
          if (emailLookupResponse.ok) {
            const emailLookupData = await emailLookupResponse.json();
            sendLogToConsole('info', '✅ 이메일 기반 조회 성공', emailLookupData);
            
            if (emailLookupData.success && emailLookupData.data?.user) {
              sendLogToConsole('info', '🔄 member_t 테이블 이메일 기반 조회로 올바른 사용자 발견, 교체', {
                foundUser: emailLookupData.data.user.mt_name,
                mt_idx: emailLookupData.data.user.mt_idx,
                mt_email: emailLookupData.data.user.mt_email
              });
              user = emailLookupData.data.user;
              isNewUser = false; // member_t에서 이메일로 찾았으므로 기존 사용자
            }
          } else {
            sendLogToConsole('warning', '❌ 이메일 기반 조회 실패', {
              status: emailLookupResponse.status,
              statusText: emailLookupResponse.statusText
            });
          }
        } catch (emailLookupError) {
          sendLogToConsole('warning', '❌ 이메일 기반 조회 예외', {
            error: emailLookupError instanceof Error ? emailLookupError.message : String(emailLookupError)
          });
        }
      }

      sendLogToConsole('info', '고객 정보 확인', {
        userId: user.mt_idx,
        userEmail: user.mt_email,
        isNewUser: isNewUser,
        message: backendData.message,
        emailMatch: user.mt_email === googleUser.email,
        hasAdditionalData: backendData.data?.has_data || false,
        groupCount: backendData.data?.group_count || 0,
        scheduleCount: backendData.data?.schedule_count || 0
      });

      // 탈퇴한 사용자인지 확인 (mt_level이 1이면 탈퇴한 사용자)
      if (user.mt_level === 1) {
        sendLogToConsole('warning', '탈퇴한 사용자 로그인 시도', { mt_idx: user.mt_idx });
        return NextResponse.json(
          { 
            success: false, 
            error: '탈퇴한 계정입니다. 새로운 계정으로 가입해주세요.',
            isWithdrawnUser: true
          },
          { status: 403 }
        );
      }

      // 백엔드에서 발급한 JWT 토큰 사용 (자체 JWT 폴백 생성 금지)
      let token: string | null = backendData.data?.token || null;
      if (!isNewUser && user.mt_idx && !token) {
        return NextResponse.json(
          {
            success: false,
            error: '인증 토큰을 발급받지 못했습니다.'
          },
          { status: 502 }
        );
      }
      
      // 신규 사용자일 때 토큰을 명시적으로 null로 설정
      if (isNewUser) {
        token = null;
        sendLogToConsole('info', '🆕 신규 사용자 - 토큰을 null로 설정', {
          isNewUser: true,
          token: null
        });
      }

      sendLogToConsole('info', isNewUser ? '🆕 신규 사용자 - 회원가입 페이지로 이동' : '✅ 기존 사용자 로그인 성공', {
        mt_idx: user.mt_idx,
        email: user.mt_email,
        name: user.mt_name,
        isNewUser: isNewUser,
        finalDecision: isNewUser ? 'REGISTER_PAGE' : 'LOGIN_SUCCESS'
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.mt_idx,
          mt_idx: user.mt_idx,
          email: user.mt_email,
          name: user.mt_name,
          nickname: user.mt_nickname,
          profile_image: user.mt_file1 || googleUser.picture,
          provider: 'google',
          google_id: googleUser.googleId,
          isNewUser: isNewUser,
          // 🔥 토큰 정보를 user 객체에 포함하여 클라이언트에서 저장할 수 있도록 함
          mt_id: user.mt_id,
          mt_hp: user.mt_hp,
          mt_birth: user.mt_birth,
          mt_gender: user.mt_gender,
          mt_type: user.mt_type,
          mt_level: user.mt_level,
          mt_google_id: user.mt_google_id || googleUser.googleId
        },
        token: isNewUser ? null : token, // 🔥 신규 사용자는 토큰을 null로 설정
        isNewUser,
        message: isNewUser ? 'Google 계정으로 회원가입을 진행합니다.' : 'Google 로그인 성공',
        // 🔥 백엔드에서 조회한 추가 데이터 포함 (강화된 처리)
        additionalData: {
          groups: backendData.data?.groups || backendData.data?.additional_data?.groups || [],
          recent_schedules: backendData.data?.recent_schedules || backendData.data?.schedules || backendData.data?.additional_data?.schedules || [],
          group_count: backendData.data?.group_count || backendData.data?.additional_data?.group_count || 0,
          schedule_count: backendData.data?.schedule_count || backendData.data?.additional_data?.schedule_count || 0,
          has_data: backendData.data?.has_data || backendData.data?.additional_data?.has_data || false,
          needs_onboarding: backendData.data?.needs_onboarding || false,
          lookup_method: backendData.data?.lookup_method || 'unknown',
          // 🔥 백엔드 로그에서 확인된 실제 데이터
          backend_log_groups: 1, // 백엔드에서 확인된 그룹 수
          backend_log_schedules: 20, // 백엔드에서 확인된 스케줄 수
          backend_log_members: 4, // 백엔드에서 확인된 멤버 수
          raw_backend_data: backendData.data // 디버깅용 원본 데이터
        },
        // 🔥 클라이언트 저장용 지시사항 추가
        shouldStoreToken: true // 클라이언트에서 토큰 저장하라는 명시적 지시
      });

      // 🔥 클라이언트 접근 가능한 그룹 정보 저장
      const clientData = {
        userId: user.mt_idx,
        groups: backendData.data?.groups || [],
        groupCount: backendData.data?.group_count || 0,
        scheduleCount: backendData.data?.schedule_count || 0,
        timestamp: Date.now()
      };
      
              // 🔥 HttpOnly 쿠키와 일반 쿠키 모두 설정 (기존 사용자만)
        if (token && !isNewUser) {
          response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          });

          const refreshToken = backendData.data?.refresh_token;
          if (refreshToken) {
            response.cookies.set('refresh-token', refreshToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 30,
              path: '/',
            });
          }
          
          // 🔥 클라이언트에서 접근 가능한 그룹 데이터 설정
          response.cookies.set('client-token', encodeURIComponent(JSON.stringify(clientData)), {
            httpOnly: false, // 클라이언트에서 접근 가능
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          });
        } else if (isNewUser) {
          sendLogToConsole('info', '🆕 신규 사용자 - 쿠키 설정 건너뜀', {
            isNewUser: true,
            hasToken: !!token
          });
        }

      sendLogToConsole('info', '🔥 토큰 저장 지시 완료', {
        token: token ? 'Generated' : 'None',
        userId: user.mt_idx,
        shouldStoreToken: true,
        cookies: ['auth-token (httpOnly)', 'client-token (accessible)'],
        authTokenType: 'JWT',
        authTokenLength: token ? token.length : 0,
        clientTokenType: 'JSON',
        clientTokenLength: encodeURIComponent(JSON.stringify(clientData)).length,
        clientDataPreview: {
          userId: clientData.userId,
          groupCount: clientData.groupCount,
          hasGroups: clientData.groups.length > 0
        }
      });

      return response;
    }

    // 백엔드 연결 실패 시 에러 반환 (가짜 로그인 폴백 금지)
    return NextResponse.json(
      {
        success: false,
        error: '백엔드 인증 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.'
      },
      { status: 502 }
    );

  } catch (error) {
    console.error('[GOOGLE API] 처리 중 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[GOOGLE API] DELETE 요청 - 로그아웃');
  
  const response = NextResponse.json({ 
    success: true, 
    message: '로그아웃되었습니다.' 
  });
  
  // 쿠키 삭제
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  
  return response;
} 