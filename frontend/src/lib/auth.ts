import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// JWT 시크릿 키 (백엔드와 동일하게 설정)
const JWT_SECRET = process.env.JWT_SECRET || 'smap!@super-secret';
console.log('[AUTH] JWT_SECRET 설정됨, 길이:', JWT_SECRET.length);

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
 * JWT 토큰 검증
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
    
    // 토큰이 없으면 null 반환
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