// 멤버 타입 정의
export interface Member {
  mt_idx: number;
  mt_type?: number;
  mt_level?: number;
  mt_status?: number;
  mt_id?: string;
  mt_name: string;
  mt_nickname?: string;
  mt_hp?: string;
  mt_email?: string;
  mt_birth?: string;
  mt_gender?: number;
  mt_file1?: string;
  mt_lat?: number;
  mt_long?: number;
  mt_sido?: string;
  mt_gu?: string;
  mt_dong?: string;
  mt_onboarding?: 'Y' | 'N';
  mt_push1?: 'Y' | 'N';
  mt_plan_check?: 'Y' | 'N';
  mt_plan_date?: string;
  mt_weather_pop?: string;
  mt_weather_sky?: number;
  mt_weather_tmn?: number;
  mt_weather_tmx?: number;
  mt_weather_date?: string;
  mt_ldate?: string;
  mt_adate?: string;
  mt_token_id?: string; // FCM 토큰
  // 약관 동의 필드
  mt_agree1?: 'Y' | 'N';  // 서비스이용약관 동의여부
  mt_agree2?: 'Y' | 'N';  // 개인정보 처리방침 동의여부
  mt_agree3?: 'Y' | 'N';  // 위치기반서비스 이용약관 동의여부
  mt_agree4?: 'Y' | 'N';  // 개인정보 제3자 제공 동의여부
  mt_agree5?: 'Y' | 'N';  // 마케팅 정보 수집 및 이용 동의
  // 추가 필드 (그룹 멤버 조회 시 사용)
  mt_regdate?: string;
  mt_wdate?: string;
}

// 그룹 타입 정의
export interface Group {
  sgt_idx: number;
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_show?: 'Y' | 'N' | null;
  sgt_wdate?: string | null;
  sgt_udate?: string | null;
}

// 그룹 생성 타입
export interface GroupCreate {
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_show?: 'Y' | 'N' | null;
}

// 그룹 업데이트 타입
export interface GroupUpdate {
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_show?: 'Y' | 'N' | null;
}

// 그룹 상세 타입 정의
export interface GroupDetail {
  sgdt_idx: number;
  sgt_idx: number;
  mt_idx: number;
  sgdt_owner_chk: 'Y' | 'N';
  sgdt_leader_chk: 'Y' | 'N';
  sgdt_discharge: 'Y' | 'N';
  sgdt_group_chk: 'Y' | 'N';
  sgdt_exit: 'Y' | 'N';
  sgdt_show: 'Y' | 'N';
  sgdt_push_chk: 'Y' | 'N';
  sgdt_wdate: string;
  sgdt_udate: string;
  sgdt_ddate: string;
  sgdt_xdate: string;
  sgdt_adate: string;
}

// 로그인 응답 타입
export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    member: Member;
    token?: string;
    refreshToken?: string;
  };
  error?: string;
}

// 로그인 요청 타입
export interface LoginRequest {
  mt_id: string;
  mt_pwd: string;
}

// API 응답의 공통 타입
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// 사용자 프로필 타입 (Member를 확장)
export interface UserProfile extends Member {
  groups?: GroupWithMembers[];
  ownedGroups?: GroupWithMembers[];
  joinedGroups?: GroupWithMembers[];
}

// 그룹 역할 타입
export interface GroupRole {
  isOwner: boolean;
  isLeader: boolean;
  canInvite: boolean;
  canEdit: boolean;
}

// 멤버가 있는 그룹 타입
export interface GroupWithMembers extends Group {
  members?: Member[];
  memberCount?: number;
  myRole: GroupRole;
}

// Auth 상태 타입
export interface AuthState {
  isLoggedIn: boolean;
  user: UserProfile | null;
  selectedGroup: GroupWithMembers | null;
  loading: boolean;
  error: string | null;
  isPreloadingComplete: boolean;
}

// Auth 액션 타입
export type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: UserProfile }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<UserProfile> }
  | { type: 'SELECT_GROUP'; payload: GroupWithMembers | null }
  | { type: 'UPDATE_GROUPS'; payload: GroupWithMembers[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PRELOADING_COMPLETE'; payload: boolean }; 