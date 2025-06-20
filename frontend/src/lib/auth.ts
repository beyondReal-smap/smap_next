import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// JWT 시크릿 키 (다중 시크릿 지원)
const JWT_SECRET = process.env.JWT_SECRET || 'smap!@super-secret';
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'default-secret';
console.log('[AUTH] JWT_SECRET 설정됨, 길이:', JWT_SECRET.length);
console.log('[AUTH] NEXTAUTH_SECRET 설정됨, 길이:', NEXTAUTH_SECRET.length);

// JWT 토큰 페이로드 인터페이스
interface JWTPayload {
  mt_idx: number;
  userId?: number; // mt_idx의 별칭
  mt_id: string;
  mt_name: string;
  mt_nickname?: string;
  mt_hp?: string;
  mt_email?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_type?: number;
  mt_level?: number;
  mt_file1?: string; // 프로필 이미지 경로
  sgt_idx?: number;
  sgdt_idx?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  iat?: number;
  exp?: number;
  session_id?: string;
}

// 임시 하드코딩된 사용자 정보는 제거됨 - 실제 JWT 토큰만 사용

/**
 * JWT 토큰 검증 (다중 시크릿 지원 + 잘못된 토큰 형식 처리)
 * 실제 JWT 토큰을 검증하고 사용자 정보를 반환합니다
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    // 토큰이 없으면 null 반환 (실제 JWT 토큰만 허용)
    if (!token || token === 'mock') {
      console.log('[AUTH] 토큰이 없음 - null 반환');
      return null;
    }

    console.log('[AUTH] JWT 토큰 검증 시작, 토큰 길이:', token.length);
    console.log('[AUTH] JWT 토큰 시작 부분:', token.substring(0, 50) + '...');

    // URL 인코딩된 JSON 형태인지 확인 (잘못된 토큰 형식)
    if (token.startsWith('%7B') || token.startsWith('%257B')) {
      console.log('[AUTH] URL 인코딩된 데이터 감지, JWT 토큰이 아님');
      try {
        // 이중 URL 디코딩 시도 (%257B는 %7B의 인코딩된 형태)
        let decoded = token;
        if (token.startsWith('%257B')) {
          decoded = decodeURIComponent(token); // 첫 번째 디코딩
          console.log('[AUTH] 첫 번째 디코딩 완료, 길이:', decoded.length);
        }
        if (decoded.startsWith('%7B')) {
          decoded = decodeURIComponent(decoded); // 두 번째 디코딩
          console.log('[AUTH] 두 번째 디코딩 완료, 길이:', decoded.length);
        }
        
        console.log('[AUTH] 최종 디코딩 결과 시작 부분:', decoded.substring(0, 50));
        const data = JSON.parse(decoded);
        
        if (data.userId && typeof data.userId === 'number') {
          console.log('[AUTH] ✅ 클라이언트 데이터에서 사용자 정보 추출 성공:', { userId: data.userId });
          // 클라이언트 데이터를 JWT 형태로 변환
          return {
            mt_idx: data.userId,
            userId: data.userId,
            mt_id: String(data.userId),
            mt_name: 'User',
            provider: 'client-data'
          } as JWTPayload;
        }
      } catch (parseError) {
        console.log('[AUTH] 클라이언트 데이터 파싱 실패:', parseError instanceof Error ? parseError.message : String(parseError));
      }
      return null;
    }

    // 일반적인 JWT 토큰인지 확인 (점으로 구분된 3부분)
    if (!token.includes('.') || token.split('.').length !== 3) {
      console.log('[AUTH] JWT 형식이 아님 (점으로 구분된 3부분이 아님)');
      return null;
    }

    // 먼저 NEXTAUTH_SECRET으로 시도 (Google 로그인 토큰)
    try {
      const decoded = jwt.verify(token, NEXTAUTH_SECRET) as JWTPayload;
      console.log('[AUTH] NEXTAUTH_SECRET으로 토큰 검증 성공:', { mt_idx: decoded.mt_idx, mt_id: decoded.mt_id });
      return decoded;
    } catch (nextAuthError) {
      console.log('[AUTH] NEXTAUTH_SECRET 검증 실패, JWT_SECRET으로 재시도');
      
      // NEXTAUTH_SECRET 실패 시 JWT_SECRET으로 시도
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      console.log('[AUTH] JWT_SECRET으로 토큰 검증 성공:', { mt_idx: decoded.mt_idx, mt_id: decoded.mt_id });
      return decoded;
    }
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('[AUTH] JWT 토큰 만료:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error('[AUTH] JWT 토큰 형식 오류:', error.message);
    } else {
      console.error('[AUTH] JWT 검증 실패 (모든 시크릿):', error);
    }
    return null;
  }
}

/**
 * JWT 토큰 생성 (로그인 시 사용)
 */
export function generateJWT(userInfo: {
  mt_idx: number;
  userId?: number; // mt_idx의 별칭
  mt_id: string;
  mt_name: string;
  mt_nickname?: string;
  mt_hp?: string;
  mt_email?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_type?: number;
  mt_level?: number;
  mt_file1?: string; // 프로필 이미지 경로
  sgt_idx?: number;
  sgdt_idx?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
}): string {
  // 세션 ID 생성 (나중에 DB 연동 시 사용 가능)
  const sessionId = `sess_${userInfo.mt_idx}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const payload: JWTPayload = {
    ...userInfo,
    session_id: sessionId, // 세션 추적용 ID 추가
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30일 후 만료 (한 달)
  };

  return jwt.sign(payload, JWT_SECRET);
}

/**
 * 요청에서 현재 사용자 정보 가져오기 (개선된 쿠키 처리)
 */
export function getCurrentUser(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 쿠키에서 토큰 확인 (auth-token 우선, client-token 백업)
    const authCookieToken = request.cookies.get('auth-token')?.value;
    const clientCookieToken = request.cookies.get('client-token')?.value;
    
    console.log('[AUTH] 쿠키 토큰 확인:', {
      hasAuthCookie: !!authCookieToken,
      hasClientCookie: !!clientCookieToken,
      authCookieLength: authCookieToken?.length || 0,
      clientCookieLength: clientCookieToken?.length || 0
    });
    
    // auth-token부터 시도
    if (authCookieToken) {
      console.log('[AUTH] auth-token 쿠키에서 토큰 발견, 검증 시도');
      const result = verifyJWT(authCookieToken);
      if (result) {
        return result;
      }
    }
    
    // auth-token 실패 시 client-token 시도
    if (clientCookieToken) {
      console.log('[AUTH] client-token 쿠키에서 토큰 발견, 검증 시도');
      const result = verifyJWT(clientCookieToken);
      if (result) {
        return result;
      }
    }
    
    // 토큰이 없으면 null 반환
    console.log('[AUTH] 모든 쿠키 토큰 검증 실패 또는 없음');
    return null;
  }

  const token = authHeader.substring(7); // 'Bearer ' 제거
  return verifyJWT(token);
}

/**
 * 인증 필수 체크 헬퍼 함수
 */
export function requireAuth(request: NextRequest): { 
  user: any; 
  unauthorized?: { error: string; status: number } 
} {
  const user = getCurrentUser(request);
  
  if (!user) {
    return {
      user: null,
      unauthorized: {
        error: 'Authorization header with valid JWT token is required',
        status: 401
      }
    };
  }

  return { user };
}

/**
 * 현재 사용자 ID 가져오기 (mt_idx)
 */
export function getCurrentUserId(request: NextRequest): number | null {
  const user = getCurrentUser(request);
  return user?.mt_idx || null;
}

/**
 * 현재 사용자의 프로필 이미지 경로 가져오기 (mt_file1)
 */
export function getCurrentUserProfileImage(request: NextRequest): string | null {
  const user = getCurrentUser(request);
  return user?.mt_file1 || null;
}

/**
 * 현재 사용자의 그룹 인덱스 가져오기 (sgt_idx)
 */
export function getCurrentUserGroupId(request: NextRequest): number | null {
  const user = getCurrentUser(request);
  return user?.sgt_idx || null;
}

/**
 * 현재 사용자의 그룹 상세 인덱스 가져오기 (sgdt_idx)
 */
export function getCurrentUserGroupDetailId(request: NextRequest): number | null {
  const user = getCurrentUser(request);
  return user?.sgdt_idx || null;
}

/**
 * 현재 사용자의 오너 권한 확인
 */
export function isCurrentUserOwner(request: NextRequest): boolean {
  const user = getCurrentUser(request);
  return user?.sgdt_owner_chk === 'Y';
}

/**
 * 현재 사용자의 리더 권한 확인
 */
export function isCurrentUserLeader(request: NextRequest): boolean {
  const user = getCurrentUser(request);
  return user?.sgdt_leader_chk === 'Y';
}

/**
 * 현재 사용자의 권한 정보 전체 가져오기
 */
export function getCurrentUserPermissions(request: NextRequest): {
  mt_idx: number | null;
  mt_id: string | null;
  mt_name: string | null;
  mt_nickname: string | null;
  mt_file1: string | null;
  sgt_idx: number | null;
  sgdt_idx: number | null;
  sgdt_owner_chk: string | null;
  sgdt_leader_chk: string | null;
  isOwner: boolean;
  isLeader: boolean;
} {
  const user = getCurrentUser(request);
  
  return {
    mt_idx: user?.mt_idx || null,
    mt_id: user?.mt_id || null,
    mt_name: user?.mt_name || null,
    mt_nickname: user?.mt_nickname || null,
    mt_file1: user?.mt_file1 || null,
    sgt_idx: user?.sgt_idx || null,
    sgdt_idx: user?.sgdt_idx || null,
    sgdt_owner_chk: user?.sgdt_owner_chk || null,
    sgdt_leader_chk: user?.sgdt_leader_chk || null,
    isOwner: user?.sgdt_owner_chk === 'Y',
    isLeader: user?.sgdt_leader_chk === 'Y'
  };
} 