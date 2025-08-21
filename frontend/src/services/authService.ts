import apiClient from './apiClient';
import { Member, Group, GroupDetail, GroupWithMembers, UserProfile, LoginRequest, LoginResponse } from '@/types/auth';

class AuthService {
  private readonly TOKEN_KEY = 'smap_auth_token';
  private readonly USER_KEY = 'smap_user_data';
  private readonly LOGIN_TIME_KEY = 'smap_login_time';
  private readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일

  /**
   * 로그인
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      // 🔄 새로운 계정으로 로그인하기 전에 이전 계정의 모든 데이터 완전 정리
      console.log('[AUTH SERVICE] 🔄 새 계정 로그인 전 이전 계정 데이터 정리 시작');
      this.clearAllPreviousAccountData();
      
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      
      if (response.data.success && response.data.data) {
        // 토큰 저장 (token이 있는 경우에만)
        console.log('[AUTH SERVICE] 로그인 응답 데이터:', response.data.data);
        console.log('[AUTH SERVICE] 토큰 존재 여부:', !!response.data.data.token);
        console.log('[AUTH SERVICE] 토큰 값:', response.data.data.token);
        
        if (response.data.data.token) {
          console.log('[AUTH SERVICE] JWT 토큰 저장 시작');
          this.setToken(response.data.data.token);
          console.log('[AUTH SERVICE] JWT 토큰 저장 완료');
          
          // 저장 확인
          const savedToken = this.getToken();
          console.log('[AUTH SERVICE] 저장된 토큰 확인:', savedToken ? '토큰 있음' : '토큰 없음');
        } else {
          console.warn('[AUTH SERVICE] 응답에 토큰이 없음');
        }
        
        // 사용자 기본 정보만 조회 (그룹 정보는 나중에)
        const userProfile = await this.getUserBasicProfile(response.data.data.member.mt_idx);
        this.setUserData(userProfile);
        
        // 로그인 시간 저장
        this.setLoginTime();
        
        console.log('[AUTH SERVICE] ✅ 새 계정 로그인 완료 및 데이터 저장 완료');
      } else {
        // 백엔드에서 success: false로 응답한 경우
        console.log('[AUTH SERVICE] 백엔드 로그인 실패 응답:', response.data);
        throw new Error(response.data.message || '로그인에 실패했습니다.');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[AUTH SERVICE] 로그인 실패:', error);
      throw error;
    }
  }

  /**
   * 로그아웃
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('[AUTH SERVICE] 로그아웃 API 호출 실패:', error);
    } finally {
      this.clearAuthData();
    }
  }

  /**
   * 사용자 기본 정보만 조회 (그룹 정보 제외)
   */
  async getUserBasicProfile(mt_idx: number): Promise<UserProfile> {
    try {
      // 사용자 기본 정보만 조회
      const memberResponse = await apiClient.get<Member>(`/members/${mt_idx}`);
      const member = memberResponse.data;

      const userProfile = {
        ...member,
        groups: [],
        ownedGroups: [],
        joinedGroups: []
      };

      console.log('[AUTH SERVICE] 사용자 기본 프로필 조회 완료:', userProfile.mt_name);
      return userProfile;
    } catch (error) {
      console.error('[AUTH SERVICE] 사용자 기본 프로필 조회 실패:', error);
      throw new Error('사용자 정보를 불러올 수 없습니다.');
    }
  }

  /**
   * 사용자 프로필 조회 (그룹 정보 포함)
   */
  async getUserProfile(mt_idx: number): Promise<UserProfile> {
    try {
      // 1. 사용자 기본 정보 조회
      const memberResponse = await apiClient.get<Member>(`/members/${mt_idx}`);
      const member = memberResponse.data;

      // 2. 사용자가 속한 그룹들 조회 (실패해도 기본 정보는 반환)
      let groups: GroupWithMembers[] = [];
      try {
        groups = await this.getUserGroups(mt_idx);
        console.log('[AUTH SERVICE] 그룹 조회 성공:', groups.length);
      } catch (error) {
        console.error('[AUTH SERVICE] 그룹 조회 실패, 빈 배열로 진행:', error);
        // 그룹 조회 실패해도 사용자 기본 정보는 반환
        groups = [];
      }

      // 3. 소유 그룹과 참여 그룹 분리
      const ownedGroups = groups.filter(group => group.myRole.isOwner);
      const joinedGroups = groups.filter(group => !group.myRole.isOwner);

      const userProfile = {
        ...member,
        groups,
        ownedGroups,
        joinedGroups
      };

      console.log('[AUTH SERVICE] 사용자 프로필 조회 완료:', userProfile.mt_name, '그룹:', groups.length);
      return userProfile;
    } catch (error) {
      console.error('[AUTH SERVICE] 사용자 프로필 조회 실패:', error);
      throw new Error('사용자 정보를 불러올 수 없습니다.');
    }
  }

  /**
   * 사용자가 속한 그룹들 조회 (localStorage에서 먼저 확인)
   */
  async getUserGroups(mt_idx: number): Promise<GroupWithMembers[]> {
    try {
      // 🔥 1. localStorage에 저장된 그룹 데이터 먼저 확인
      if (typeof window !== 'undefined') {
        const storedGroups = localStorage.getItem('user_groups');
        if (storedGroups) {
          const groups = JSON.parse(storedGroups);
          if (Array.isArray(groups) && groups.length > 0) {
            console.log('[AUTH SERVICE] localStorage에서 그룹 데이터 발견:', groups.length, '개');
            return groups;
          }
        }
        
        // 사용자 데이터에서 그룹 정보 확인
        const userData = this.getUserData();
        if (userData && userData.groups && userData.groups.length > 0) {
          console.log('[AUTH SERVICE] 사용자 데이터에서 그룹 정보 발견:', userData.groups.length, '개');
          return userData.groups;
        }
      }
      
      console.log('[AUTH SERVICE] ⚠️ localStorage에 그룹 데이터 없음 - API 호출로 대체');
      
      // 🔥 2. localStorage에 데이터가 없으면 API 호출 (복원)
      const groupDetailsResponse = await apiClient.get<GroupDetail[]>(`/group-details/member/${mt_idx}`);
      const groupDetails = groupDetailsResponse.data.filter(
        detail => detail.sgdt_show === 'Y' && detail.sgdt_exit === 'N' && detail.sgdt_discharge === 'N'
      );

      if (groupDetails.length === 0) {
        console.log('[AUTH SERVICE] 사용자가 속한 그룹이 없음');
        return [];
      }

      // 3. 각 그룹의 기본 정보와 멤버 정보 조회
      const groupsWithMembers = await Promise.all(
        groupDetails.map(async (detail) => {
          const [groupResponse, membersResponse] = await Promise.all([
            apiClient.get<Group>(`/groups/${detail.sgt_idx}`),
            apiClient.get<(Member & GroupDetail)[]>(`/groups/${detail.sgt_idx}/members`)
          ]);

          const group = groupResponse.data;
          const members = membersResponse.data;

          return {
            ...group,
            members,
            memberCount: members.length,
            myRole: {
              isOwner: detail.sgdt_owner_chk === 'Y',
              isLeader: detail.sgdt_leader_chk === 'Y',
              canInvite: detail.sgdt_leader_chk === 'Y' || detail.sgdt_owner_chk === 'Y',
              canEdit: detail.sgdt_owner_chk === 'Y'
            }
          } as GroupWithMembers;
        })
      );

      console.log('[AUTH SERVICE] API에서 그룹 데이터 조회 완료:', groupsWithMembers.length, '개');
      return groupsWithMembers;
      
    } catch (error) {
      console.error('[AUTH SERVICE] 사용자 그룹 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 그룹의 상세 정보 조회
   */
  async getGroupDetail(sgt_idx: number, mt_idx: number): Promise<GroupWithMembers | null> {
    try {
      const [groupResponse, membersResponse, myDetailResponse] = await Promise.all([
        apiClient.get<Group>(`/groups/${sgt_idx}`),
        apiClient.get<(Member & GroupDetail)[]>(`/groups/${sgt_idx}/members`),
        apiClient.get<GroupDetail>(`/group-details/group/${sgt_idx}/member/${mt_idx}`)
      ]);

      const group = groupResponse.data;
      const members = membersResponse.data;
      const myDetail = myDetailResponse.data;

      return {
        ...group,
        members,
        memberCount: members.length,
        myRole: {
          isOwner: myDetail.sgdt_owner_chk === 'Y',
          isLeader: myDetail.sgdt_leader_chk === 'Y',
          canInvite: myDetail.sgdt_leader_chk === 'Y' || myDetail.sgdt_owner_chk === 'Y',
          canEdit: myDetail.sgdt_owner_chk === 'Y'
        }
      };
    } catch (error) {
      console.error('[AUTH SERVICE] 그룹 상세 조회 실패:', error);
      return null;
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  async updateUserProfile(mt_idx: number, updateData: Partial<Member>): Promise<Member> {
    try {
      const response = await apiClient.put<Member>(`/members/${mt_idx}`, updateData);
      
      // 로컬 스토리지의 사용자 데이터도 업데이트
      const currentUser = this.getUserData();
      if (currentUser) {
        const updatedUser = { ...currentUser, ...response.data };
        this.setUserData(updatedUser);
      }
      
      return response.data;
    } catch (error) {
      console.error('[AUTH SERVICE] 사용자 정보 업데이트 실패:', error);
      throw new Error('사용자 정보 업데이트에 실패했습니다.');
    }
  }

  /**
   * 토큰 저장
   */
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
      
      // 쿠키에도 토큰 저장 (middleware에서 사용)
      const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `auth-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure}`;
    }
  }

  /**
   * 토큰 조회
   */
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      // 새로운 토큰 키로 조회
      let token = localStorage.getItem(this.TOKEN_KEY);
      
      // 만약 새로운 키에 토큰이 없고, 기존 키에 토큰이 있다면 마이그레이션
      if (!token) {
        const oldToken = localStorage.getItem('smap_auth_token');
        if (oldToken) {
          console.log('[AUTH SERVICE] 기존 토큰을 새로운 키로 마이그레이션');
          localStorage.setItem(this.TOKEN_KEY, oldToken);
          localStorage.removeItem('smap_auth_token'); // 기존 토큰 삭제
          token = oldToken;
        }
      }
      
      return token;
    }
    return null;
  }

  /**
   * 사용자 데이터 저장
   */
  setUserData(userData: UserProfile): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
    }
  }

  /**
   * 사용자 데이터 조회
   */
  getUserData(): UserProfile | null {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    }
    return null;
  }

  /**
   * 인증 데이터 삭제
   */
  clearAuthData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.LOGIN_TIME_KEY); // 로그인 시간 삭제
      
      // 쿠키에서도 토큰 삭제
      const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${isSecure}`;
      
      // 🔥 Google SDK 토큰 캐시 정리 (로그아웃 후 재시도 문제 해결)
      try {
        if ((window as any).google?.accounts?.id) {
          console.log('[AUTH SERVICE] Google SDK 토큰 캐시 정리 시작');
          
          // Google SDK의 내부 상태 초기화
          (window as any).google.accounts.id.cancel();
          
          // 추가적인 캐시 정리
          if ((window as any).google.accounts.id.disableAutoSelect) {
            (window as any).google.accounts.id.disableAutoSelect();
          }
          
          // Google SDK 재초기화 (캐시 완전 정리)
          if ((window as any).google.accounts.id.initialize) {
            const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '283271180972-02ajuasfuecajd0holgu7iqb5hvtjgbp.apps.googleusercontent.com';
            (window as any).google.accounts.id.initialize({
              client_id: clientId,
              auto_select: false,
              cancel_on_tap_outside: true
            });
          }
          
          console.log('[AUTH SERVICE] Google SDK 토큰 캐시 정리 완료');
        }
      } catch (googleError) {
        console.warn('[AUTH SERVICE] Google SDK 캐시 정리 중 오류 (무시):', googleError);
      }
      
      console.log('[AUTH SERVICE] 로컬스토리지, 쿠키, Google SDK 캐시 삭제 완료');
    }
  }

  /**
   * 이전 계정의 모든 데이터 완전 정리 (새 계정 로그인 전)
   */
  clearAllPreviousAccountData(): void {
    if (typeof window !== 'undefined') {
      console.log('[AUTH SERVICE] 🔄 이전 계정의 모든 데이터 완전 정리 시작');
      
      // 1. 기본 인증 데이터 정리
      this.clearAuthData();
      
      // 2. 사용자 관련 모든 데이터 정리
      const keysToRemove = [
        // 기본 인증 관련
        'smap_auth_token',
        'smap_user_data', 
        'smap_login_time',
        'auth-token',
        
        // 사용자 프로필 관련
        'user_profile',
        'user_groups',
        'user_group_members',
        'user_schedules',
        'user_group_places',
        'user_location_data',
        'user_daily_location_counts',
        
        // FCM 관련
        'fcm_token',
        'fcm_token_data',
        
        // 기타 앱 데이터
        'app_settings',
        'user_preferences',
        'last_known_location',
        'location_permission_status',
        
        // 소셜 로그인 관련
        'google_auth_state',
        'kakao_auth_state',
        'apple_auth_state',
        
        // 캐시 관련
        'data_cache',
        'api_cache',
        'map_cache',
        
        // 세션 관련
        'session_data',
        'temp_data',
        'form_data'
      ];
      
      // 3. 모든 관련 키 삭제
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`[AUTH SERVICE] 🗑️ ${key} 삭제됨`);
        }
      });
      
      // 4. 패턴으로 시작하는 키들도 삭제 (동적으로 생성된 키들)
      const allKeys = Object.keys(localStorage);
      const patternKeys = [
        'user_',
        'group_',
        'schedule_',
        'location_',
        'fcm_',
        'cache_',
        'temp_',
        'session_'
      ];
      
      patternKeys.forEach(pattern => {
        allKeys.forEach(key => {
          if (key.startsWith(pattern) && key !== 'user_groups') { // user_groups는 이미 삭제됨
            localStorage.removeItem(key);
            console.log(`[AUTH SERVICE] 🗑️ 패턴 키 ${key} 삭제됨`);
          }
        });
      });
      
      // 5. 쿠키에서도 관련 데이터 정리
      const cookiesToRemove = [
        'auth-token',
        'user-session',
        'login-state',
        'social-auth'
      ];
      
      cookiesToRemove.forEach(cookieName => {
        const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${isSecure}`;
      });
      
      // 6. sessionStorage도 정리
      if (sessionStorage.length > 0) {
        sessionStorage.clear();
        console.log('[AUTH SERVICE] 🗑️ sessionStorage 완전 정리됨');
      }
      
      // 7. 전역 변수들 정리
      if (typeof window !== 'undefined') {
        const globalVarsToClear = [
          '__SIGNIN_ERROR_MODAL_ACTIVE__',
          '__GOOGLE_LOGIN_IN_PROGRESS__',
          '__BLOCK_ALL_REDIRECTS__',
          'nativeFCMToken',
          'fcmTokenService',
          'googleAuthState',
          'kakaoAuthState'
        ];
        
        globalVarsToClear.forEach(varName => {
          if ((window as any)[varName] !== undefined) {
            delete (window as any)[varName];
            console.log(`[AUTH SERVICE] 🗑️ 전역 변수 ${varName} 삭제됨`);
          }
        });
      }
      
      console.log('[AUTH SERVICE] ✅ 이전 계정의 모든 데이터 완전 정리 완료');
    }
  }

  /**
   * 로그인 상태 확인
   */
  isLoggedIn(): boolean {
    const token = this.getToken();
    const userData = this.getUserData();
    const loginTime = this.getLoginTime();

    // 로컬스토리지에 토큰이 없으면 쿠키도 확인
    if (!token && typeof window !== 'undefined') {
      const cookieToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1];
      
      if (cookieToken && userData) {
        console.log('[AUTH SERVICE] 쿠키에서 토큰 발견, 자동 로그인 유지');
        return true;
      }
    }
    
    // 토큰이 있고, 사용자 데이터가 있으며, 로그인 시간이 유효한 경우
    if (token && userData && loginTime) {
      const currentTime = Date.now();
      const timeSinceLogin = currentTime - loginTime;
      if (timeSinceLogin < this.SESSION_DURATION) {
        console.log('[AUTH SERVICE] 토큰 유효, 로그인 시간 유효, 자동 로그인 유지');
        return true;
      } else {
        console.warn('[AUTH SERVICE] 토큰 유효, 로그인 시간 만료, 로그아웃 필요');
        this.clearAuthData(); // 세션 만료된 경우 데이터 삭제
        return false;
      }
    }
    
    return false;
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(): Promise<string> {
    try {
      const response = await apiClient.post<{ token: string }>('/auth/refresh');
      this.setToken(response.data.token);
      return response.data.token;
    } catch (error) {
      console.error('[AUTH SERVICE] 토큰 갱신 실패:', error);
      this.clearAuthData();
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }
  }

  /**
   * 토큰 만료 확인 및 자동 갱신
   */
  async checkAndRefreshToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) return false;

      // JWT 토큰 디코딩하여 만료 시간 확인
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - currentTime;

      // 토큰이 3일 이내에 만료되면 갱신
      if (timeUntilExpiry < 60 * 60 * 24 * 3) {
        console.log('[AUTH SERVICE] 토큰 만료 임박, 자동 갱신 시도');
        await this.refreshToken();
        return true;
      }

      return true;
    } catch (error) {
      console.error('[AUTH SERVICE] 토큰 확인 실패:', error);
      return false;
    }
  }

  /**
   * 현재 로그인된 사용자의 최신 정보 조회
   */
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      // 현재 저장된 사용자 정보 확인
      const currentUser = this.getUserData();
      if (!currentUser) {
        console.log('[AUTH SERVICE] 저장된 사용자 정보 없음');
        return null;
      }

      console.log('[AUTH SERVICE] 현재 사용자 최신 정보 조회 시작:', currentUser.mt_idx);

      // 최신 사용자 정보 조회
      const updatedProfile = await this.getUserProfile(currentUser.mt_idx);
      
      // 로컬 스토리지 업데이트
      this.setUserData(updatedProfile);
      
      console.log('[AUTH SERVICE] 사용자 정보 업데이트 완료');
      return updatedProfile;
    } catch (error) {
      console.error('[AUTH SERVICE] 현재 사용자 정보 조회 실패:', error);
      
      // 실패 시 저장된 정보 반환
      return this.getUserData();
    }
  }

  /**
   * 로그인 시간 저장
   */
  setLoginTime(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.LOGIN_TIME_KEY, Date.now().toString());
    }
  }

  /**
   * 로그인 시간 조회
   */
  getLoginTime(): number | null {
    if (typeof window !== 'undefined') {
      const loginTime = localStorage.getItem(this.LOGIN_TIME_KEY);
      return loginTime ? parseInt(loginTime, 10) : null;
    }
    return null;
  }
}

// 싱글톤 인스턴스 생성
const authService = new AuthService();
export default authService; 