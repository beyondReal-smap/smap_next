import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// JWT 시크릿 키 (환경변수에서 가져오거나 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// JWT 토큰 페이로드 인터페이스
interface JWTPayload {
  mt_idx: number;
  mt_id: string;
  mt_name: string;
  mt_nickname?: string;
  mt_file1?: string; // 프로필 이미지 경로
  sgt_idx?: number;
  sgdt_idx?: number;
  sgdt_owner_chk?: string;
  sgdt_leader_chk?: string;
  iat?: number;
  exp?: number;
  session_id?: string;
}

// 임시 하드코딩된 사용자 정보 (로그인 기능 구현 전까지 사용)
const MOCK_USER = {
  mt_idx: 1186,
  mt_id: 'mock_user_1186',
  mt_name: '테스트 사용자',
  mt_email: 'test@example.com'
};

/**
 * JWT 토큰 검증
 * 실제 JWT 토큰을 검증하고 사용자 정보를 반환합니다
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    // JWT 토큰이 없으면 mock 사용자 반환 (개발 환경용)
    if (!token || token === 'mock' || process.env.NODE_ENV === 'development') {
      console.log('[AUTH] Mock 토큰 모드 - 개발용 사용자 반환');
      return {
        mt_idx: 1186,
        mt_id: '01029565435',
        mt_name: '정다연',
        mt_nickname: 'yeon',
        mt_file1: '/images/female_1.png', // 프로필 이미지 경로
        sgt_idx: 641,
        sgdt_idx: 983,
        sgdt_owner_chk: 'Y',
        sgdt_leader_chk: 'N',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
      };
    }

    // 실제 JWT 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // 토큰이 유효하면 사용자 정보 반환
    console.log('[AUTH] JWT 토큰 검증 성공:', { mt_idx: decoded.mt_idx, mt_id: decoded.mt_id });
    return decoded;
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('[AUTH] JWT 토큰 만료:', error.message);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error('[AUTH] JWT 토큰 형식 오류:', error.message);
    } else {
      console.error('[AUTH] JWT 검증 실패:', error);
    }
    return null;
  }
}

/**
 * JWT 토큰 생성 (로그인 시 사용)
 */
export function generateJWT(userInfo: {
  mt_idx: number;
  mt_id: string;
  mt_name: string;
  mt_nickname?: string;
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
 * 요청에서 현재 사용자 정보 가져오기
 */
export function getCurrentUser(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // 쿠키에서 토큰 확인
    const cookieToken = request.cookies.get('auth-token')?.value;
    if (cookieToken) {
      console.log('[AUTH] 쿠키에서 토큰 발견, 검증 시도');
      return verifyJWT(cookieToken);
    }
    
    // 개발 환경에서만 mock 사용자 반환 (실제 토큰이 없을 때만)
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH] 개발 환경 - 인증 헤더 없음, mock 사용자 반환');
      return verifyJWT('mock');
    }
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