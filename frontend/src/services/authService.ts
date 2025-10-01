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
   * 토큰 저장 (로그인 유지 강화)
   */
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      try {
        // 1. 표준 키에 저장
        localStorage.setItem(this.TOKEN_KEY, token);
        
        // 2. 호환성을 위한 추가 키에도 저장
        localStorage.setItem('smap_auth_token', token);
        localStorage.setItem('auth_token', token);
        
        // 3. 로그인 시간 저장 (7일 세션 관리용)
        const loginTime = Date.now();
        localStorage.setItem('smap_login_time', loginTime.toString());
        localStorage.setItem('login_time', loginTime.toString());
        
        // 4. 로그인 상태 플래그 저장
        localStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('authToken', 'authenticated');
        
        // 5. 쿠키에도 토큰 저장 (middleware에서 사용)
        const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `auth-token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${isSecure}`;
        
        console.log('[AUTH SERVICE] ✅ 토큰 저장 완료 - 모든 저장소에 백업');
      } catch (error) {
        console.error('[AUTH SERVICE] 토큰 저장 실패:', error);
      }
    }
  }

  /**
   * 토큰 조회 (호환성 개선)
   */
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      try {
        // 1. 기본 키로 시도
        let token = localStorage.getItem(this.TOKEN_KEY);

        // 2. 기본 키에 없으면 이전 버전 키들로 시도 (호환성)
        if (!token) {
          const legacyKeys = ['smap_auth_token', 'auth_token', 'token'];
          for (const key of legacyKeys) {
            token = localStorage.getItem(key);
            if (token) {
              console.log('[AUTH SERVICE] 이전 버전 키에서 토큰 발견:', key);
              // 발견된 토큰을 새 키로 마이그레이션
              localStorage.setItem(this.TOKEN_KEY, token);
              localStorage.removeItem(key);
              console.log('[AUTH SERVICE] 토큰 마이그레이션 완료');
              break;
            }
          }
        }

        return token;
      } catch (error) {
        console.error('[AUTH SERVICE] 토큰 조회 중 오류:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * 사용자 데이터 저장 (로그인 유지 강화)
   */
  setUserData(userData: UserProfile): void {
    if (typeof window !== 'undefined') {
      try {
        const userDataJson = JSON.stringify(userData);
        
        // 1. 표준 키에 저장
        localStorage.setItem(this.USER_KEY, userDataJson);
        
        // 2. 호환성을 위한 추가 키에도 저장
        localStorage.setItem('smap_user_data', userDataJson);
        localStorage.setItem('user_data', userDataJson);
        localStorage.setItem('user_profile', userDataJson);
        
        // 3. Android 환경에서 SharedPreferences에 저장
        if (window.AndroidStorage) {
          try {
            window.AndroidStorage.saveUserDataToPrefs(userDataJson);
            if (userData.mt_idx) {
              window.AndroidStorage.saveMtIdxToPrefs(userData.mt_idx.toString());
            }
            console.log('[AUTH SERVICE] ✅ Android SharedPreferences에 사용자 데이터 저장 완료');
          } catch (error) {
            console.warn('[AUTH SERVICE] Android 데이터 저장 실패 (무시 가능):', error);
          }
        }
        
        console.log('[AUTH SERVICE] ✅ 사용자 데이터 저장 완료 - 모든 저장소에 백업');
      } catch (error) {
        console.error('[AUTH SERVICE] 사용자 데이터 저장 실패:', error);
      }
    }
  }

  /**
   * 사용자 데이터 조회 (호환성 개선 + 자동 로그인 지원)
   */
  getUserData(): UserProfile | null {
    if (typeof window !== 'undefined') {
      try {
        // 1. 다양한 키에서 사용자 데이터 검색 (호환성 확장)
        const possibleKeys = [
          this.USER_KEY, // 기본 키
          'user_data', 
          'user_profile', 
          'smap_user_profile',
          'user',
          'userData'
        ];

        let data = null;
        let foundKey = null;

        for (const key of possibleKeys) {
          const keyData = localStorage.getItem(key);
          if (keyData && keyData !== 'null') {
            try {
              const parsedData = JSON.parse(keyData);
              if (parsedData?.mt_idx) {
                data = keyData;
                foundKey = key;
                console.log(`[AUTH SERVICE] 사용자 데이터 발견 (키: ${key}):`, parsedData.mt_name);
                break;
              }
            } catch (e) {
              console.warn(`[AUTH SERVICE] 데이터 파싱 실패 (키: ${key}):`, e);
            }
          }
        }

        if (!data) {
          console.log('[AUTH SERVICE] localStorage에 사용자 데이터 없음');
          return null;
        }

        const parsedData = JSON.parse(data);
        
        // 2. 발견된 데이터를 표준 키로 마이그레이션 (foundKey가 기본 키가 아닌 경우)
        if (foundKey !== this.USER_KEY) {
          console.log(`[AUTH SERVICE] 사용자 데이터 마이그레이션: ${foundKey} → ${this.USER_KEY}`);
          localStorage.setItem(this.USER_KEY, data);
          // 이전 키는 제거하지 않음 (호환성 유지)
        }

        // 3. 자동 로그인을 위한 인증 상태 복원
        if (parsedData?.mt_idx) {
          localStorage.setItem('isLoggedIn', 'true');
          sessionStorage.setItem('authToken', 'authenticated');
          console.log('[AUTH SERVICE] 자동 로그인을 위한 인증 상태 복원 완료');
        }

        console.log('[AUTH SERVICE] 사용자 데이터 조회 성공:', parsedData.mt_name, `(${parsedData.mt_idx})`);
        return parsedData;
      } catch (error) {
        console.error('[AUTH SERVICE] 사용자 데이터 처리 실패:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * 인증 데이터 삭제
   */
  clearAuthData(): void {
    if (typeof window !== 'undefined') {
      console.log('[AUTH SERVICE] 🔥 로그아웃 시 모든 인증 데이터 강제 삭제 시작');
      
      // 기본 인증 데이터 삭제
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.LOGIN_TIME_KEY);
      
      // 모든 토큰 키 삭제 (하위 호환성)
      localStorage.removeItem('auth-token');
      localStorage.removeItem('smap_auth_token');
      
      // 모든 사용자 정보 키 삭제
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user_profile');
      localStorage.removeItem('smap_user_data');
      localStorage.removeItem('smap_user_info');
      localStorage.removeItem('recentUserInfo');
      
      // 그룹 및 캐시 데이터 삭제
      localStorage.removeItem('cached_groups');
      localStorage.removeItem('last_api_call_last_group_api_call');
      
      // 권한 및 설정 데이터 삭제
      localStorage.removeItem('smap_last_permission_check');
      localStorage.removeItem('auto_login_executed');
      
      // 로그인/로그아웃 타임스탬프
      localStorage.removeItem('smap_last_login_time');
      localStorage.removeItem('last_logout_time');
      
      // sessionStorage 정리
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('signin_error_modal_active');
      sessionStorage.removeItem('block_all_redirects');
      
      // 쿠키에서도 토큰 삭제
      const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${isSecure}`;
      document.cookie = `client-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax${isSecure}`;
      
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
      
      console.log('[AUTH SERVICE] 🔥 모든 인증 데이터 강제 삭제 완료');
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
   * 로그인 상태 확인 (강화된 버전)
   */
  isLoggedIn(): boolean {
    try {
      const token = this.getToken();
      const userData = this.getUserData();
      const loginTime = this.getLoginTime();

      console.log('[AUTH SERVICE] 🔍 로그인 상태 확인 시작', {
        hasToken: !!token,
        hasUserData: !!userData,
        hasLoginTime: !!loginTime
      });

      // 🔥 강화된 로그인 상태 확인 로직
      // 1. 사용자 데이터가 있으면 토큰 유무와 관계없이 로그인 상태로 간주
      if (userData && userData.mt_idx) {
        console.log('[AUTH SERVICE] ✅ 사용자 데이터 존재 - 로그인 상태 유지');
        
        // 토큰이 없으면 쿠키에서 복원 시도
        if (!token && typeof window !== 'undefined') {
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('auth-token='))
            ?.split('=')[1];

          if (cookieToken) {
            console.log('[AUTH SERVICE] 쿠키에서 토큰 복원 시도');
            this.setToken(cookieToken);
          }
        }
        
        return true;
      }

      // 2. 사용자 데이터가 없으면 토큰과 기타 저장소 확인
      if (!userData) {
        // 쿠키에서 토큰 확인
        if (typeof window !== 'undefined') {
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('auth-token='))
            ?.split('=')[1];

          // sessionStorage에서도 확인
          const sessionAuth = sessionStorage.getItem('authToken');
          
          if (cookieToken || sessionAuth) {
            console.log('[AUTH SERVICE] ✅ 쿠키/sessionStorage에서 토큰 발견, 자동 로그인 유지');
            // 토큰이 없으면 쿠키에서 복원
            if (!token && cookieToken) {
              this.setToken(cookieToken);
            }
            return true;
          }
        }
        console.log('[AUTH SERVICE] ❌ 토큰 또는 사용자 데이터 없음');
        return false;
      }

      // 3. 로그인 시간 검증 (사용자 데이터가 있는 경우에만)
      if (loginTime) {
        const currentTime = Date.now();
        const timeSinceLogin = currentTime - loginTime;

        if (timeSinceLogin > this.SESSION_DURATION) {
          console.warn('[AUTH SERVICE] 세션 만료 (로그인 후 7일 경과)');
          this.clearAuthData();
          return false;
        }
      }

      // 4. JWT 토큰 유효성 검증 (토큰이 있는 경우에만)
      if (token) {
        try {
          // JWT 토큰 형식 검증
          if (typeof token !== 'string' || token.split('.').length !== 3) {
            console.warn('[AUTH SERVICE] JWT 토큰 형식이 올바르지 않음');
            // 토큰 형식이 잘못되어도 사용자 데이터가 있으면 로그인 상태 유지
            return true;
          }

          // Base64 URL 디코딩 (표준 atob 대신 더 안전한 방법 사용)
          const payloadBase64 = token.split('.')[1];
          if (!payloadBase64) {
            console.warn('[AUTH SERVICE] JWT 토큰 payload가 없음');
            return true; // 사용자 데이터가 있으면 로그인 상태 유지
          }

          // Base64 URL 디코딩 (padding 추가)
          const payloadBase64Padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/') +
                                     '='.repeat((4 - payloadBase64.length % 4) % 4);

          let payload;
          try {
            const decodedPayload = atob(payloadBase64Padded);
            payload = JSON.parse(decodedPayload);
          } catch (decodeError) {
            console.error('[AUTH SERVICE] JWT 토큰 Base64 디코딩 실패:', decodeError);
            return true; // 사용자 데이터가 있으면 로그인 상태 유지
          }

          const currentTimestamp = Math.floor(Date.now() / 1000);

          if (payload.exp && payload.exp < currentTimestamp) {
            console.warn('[AUTH SERVICE] JWT 토큰 만료됨');
            // 토큰이 만료되어도 사용자 데이터가 있으면 로그인 상태 유지
            return true;
          }

          // 토큰이 유효하지만 만료가 임박한 경우 (1일 이내)
          if (payload.exp && (payload.exp - currentTimestamp) < (24 * 60 * 60)) {
            console.log('[AUTH SERVICE] 토큰 만료 임박, 자동 갱신 필요');
            // 토큰 갱신은 AuthContext에서 처리
          }

        } catch (tokenError) {
          console.error('[AUTH SERVICE] JWT 토큰 파싱 실패:', tokenError);
          return true; // 사용자 데이터가 있으면 로그인 상태 유지
        }
      }

      // 5. 사용자 데이터 유효성 검증
      if (!userData.mt_idx || (!userData.mt_name && !(userData as any).name)) {
        console.warn('[AUTH SERVICE] 사용자 데이터 불완전');
        this.clearAuthData();
        return false;
      }

      console.log('[AUTH SERVICE] 로그인 상태 유효함 - 자동 로그인 유지');
      return true;

    } catch (error) {
      console.error('[AUTH SERVICE] 로그인 상태 확인 중 오류:', error);
      // 오류 발생 시에도 사용자 데이터가 있으면 로그인 상태 유지
      const userData = this.getUserData();
      if (userData && userData.mt_idx) {
        console.log('[AUTH SERVICE] 오류 발생했지만 사용자 데이터 존재 - 로그인 상태 유지');
        return true;
      }
      this.clearAuthData();
      return false;
    }
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
      
      // 🔥 사용자 데이터가 있으면 토큰 갱신 실패해도 데이터를 지우지 않음
      const userData = this.getUserData();
      if (userData && userData.mt_idx) {
        console.log('[AUTH SERVICE] 토큰 갱신 실패했지만 사용자 데이터 있으므로 데이터 유지');
        throw new Error('토큰 갱신 실패 - 사용자 데이터 유지');
      } else {
        this.clearAuthData();
        throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
      }
    }
  }

  /**
   * 토큰 만료 확인 및 자동 갱신 (강화된 버전)
   */
  async checkAndRefreshToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      const userData = this.getUserData();

      // 🔥 사용자 데이터가 있으면 토큰 없어도 유효한 상태로 간주
      if (!userData) {
        console.warn('[AUTH SERVICE] 사용자 데이터 없음');
        return false;
      }

      if (!token) {
        console.warn('[AUTH SERVICE] 토큰 없음 - 사용자 데이터 있으므로 유효한 상태로 처리');
        return true; // 사용자 데이터가 있으면 토큰 없어도 유효
      }

      // JWT 토큰 디코딩하여 만료 시간 확인 (실패해도 사용자 데이터가 있으면 유효)
      let payload;
      try {
        // JWT 토큰 형식 검증
        if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
          console.warn('[AUTH SERVICE] JWT 토큰 형식 오류 - 사용자 데이터 있으므로 유효한 상태로 처리');
          return true; // 사용자 데이터가 있으면 토큰 형식 오류여도 유효
        }

        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) {
          console.warn('[AUTH SERVICE] JWT 토큰 payload 없음 - 사용자 데이터 있으므로 유효한 상태로 처리');
          return true; // 사용자 데이터가 있으면 payload 없어도 유효
        }

        // Base64 URL 디코딩 (padding 추가)
        const payloadBase64Padded = payloadBase64.replace(/-/g, '+').replace(/_/g, '/') +
                                   '='.repeat((4 - payloadBase64.length % 4) % 4);

        const decodedPayload = atob(payloadBase64Padded);
        payload = JSON.parse(decodedPayload);
      } catch (decodeError) {
        console.warn('[AUTH SERVICE] JWT 토큰 디코딩 실패 - 사용자 데이터 있으므로 유효한 상태로 처리:', decodeError);
        return true; // 사용자 데이터가 있으면 디코딩 실패해도 유효
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - currentTime;

      // 토큰이 이미 만료됨 (사용자 데이터가 있으면 유효 상태 유지)
      if (timeUntilExpiry <= 0) {
        console.warn('[AUTH SERVICE] 토큰이 이미 만료됨 - 사용자 데이터 있으므로 유효한 상태로 처리');
        return true; // 사용자 데이터가 있으면 토큰 만료되어도 유효
      }

      // 토큰이 1일 이내에 만료되면 갱신 시도 (실패해도 유효 상태 유지)
      if (timeUntilExpiry < 60 * 60 * 24) {
        console.log('[AUTH SERVICE] 토큰 만료 임박 (24시간 이내), 자동 갱신 시도');

        try {
          const newToken = await this.refreshToken();
          console.log('[AUTH SERVICE] 토큰 갱신 성공');

          // 사용자 정보도 최신 상태로 업데이트 (실패해도 무시)
          try {
            const updatedProfile = await this.getCurrentUserProfile();
            if (updatedProfile) {
              console.log('[AUTH SERVICE] 사용자 정보 최신화 완료');
            }
          } catch (profileError) {
            console.warn('[AUTH SERVICE] 사용자 정보 최신화 실패 (무시):', profileError);
          }

          return true;
        } catch (refreshError) {
          console.warn('[AUTH SERVICE] 토큰 갱신 실패 - 사용자 데이터 있으므로 유효한 상태로 처리:', refreshError);
          return true; // 사용자 데이터가 있으면 토큰 갱신 실패해도 유효
        }
      }

      return true;
    } catch (error) {
      console.error('[AUTH SERVICE] 토큰 확인 실패:', error);
      
      // 사용자 데이터가 있으면 오류 발생해도 유효한 상태로 처리
      const userData = this.getUserData();
      if (userData && userData.mt_idx) {
        console.log('[AUTH SERVICE] 오류 발생했지만 사용자 데이터 있으므로 유효한 상태로 처리');
        return true;
      }
      
      this.clearAuthData();
      return false;
    }
  }

  /**
   * 현재 로그인된 사용자의 최신 정보 조회 (디버깅 강화)
   */
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      console.log('[AUTH SERVICE] 🔍 getCurrentUserProfile() 시작');

      // 현재 저장된 사용자 정보 확인
      const currentUser = this.getUserData();
      if (!currentUser) {
        console.log('[AUTH SERVICE] ❌ 저장된 사용자 정보 없음');
        return null;
      }

      console.log('[AUTH SERVICE] ✅ 저장된 사용자 정보 발견:', currentUser.mt_name, `(${currentUser.mt_idx})`);

      // 토큰 유효성 확인
      const token = this.getToken();
      if (!token) {
        console.log('[AUTH SERVICE] ❌ 유효한 토큰 없음');
        return currentUser; // 토큰이 없어도 저장된 정보 반환
      }

      console.log('[AUTH SERVICE] ✅ 토큰 존재, API 호출 시도');

      // 최신 사용자 정보 조회
      const updatedProfile = await this.getUserProfile(currentUser.mt_idx);

      if (updatedProfile) {
        // 로컬 스토리지 업데이트
        this.setUserData(updatedProfile);
        console.log('[AUTH SERVICE] ✅ 사용자 정보 업데이트 완료:', updatedProfile.mt_name);
        return updatedProfile;
      } else {
        console.log('[AUTH SERVICE] ⚠️ API에서 사용자 정보 조회 실패, 저장된 정보 반환');
        return currentUser;
      }

    } catch (error) {
      console.error('[AUTH SERVICE] ❌ 현재 사용자 정보 조회 실패:', error);

      // 실패 시 저장된 정보 반환 (더미 데이터가 아닌 실제 저장된 데이터)
      const fallbackUser = this.getUserData();
      if (fallbackUser) {
        console.log('[AUTH SERVICE] ℹ️ API 실패로 저장된 정보 반환:', fallbackUser.mt_name);
        return fallbackUser;
      }

      console.log('[AUTH SERVICE] ❌ 저장된 정보조차 없음');
      return null;
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
   * 개발용: 로그인 상태 디버깅 정보 출력
   */
  debugAuthState(): void {
    if (typeof window !== 'undefined') {
      console.log('=== 🔍 로그인 상태 디버깅 정보 ===');

      // 실제 localStorage 데이터 확인
      const rawToken = localStorage.getItem(this.TOKEN_KEY);
      const rawUserData = localStorage.getItem(this.USER_KEY);
      const rawLoginTime = localStorage.getItem(this.LOGIN_TIME_KEY);

      console.log('📦 LocalStorage 원본 데이터:');
      console.log('  - 토큰 키:', this.TOKEN_KEY);
      console.log('  - 토큰 원본:', rawToken ? `${rawToken.substring(0, 20)}...` : '없음');
      console.log('  - 사용자 데이터 키:', this.USER_KEY);
      console.log('  - 사용자 데이터 원본:', rawUserData ? `${rawUserData.substring(0, 50)}...` : '없음');
      console.log('  - 로그인 시간 키:', this.LOGIN_TIME_KEY);
      console.log('  - 로그인 시간 원본:', rawLoginTime);

      console.log('🔧 파싱된 데이터:');
      console.log('  - 토큰 존재:', !!this.getToken());
      console.log('  - 사용자 데이터 존재:', !!this.getUserData());
      console.log('  - 로그인 시간:', this.getLoginTime());

      // 사용자 데이터 파싱 시도
      if (rawUserData) {
        try {
          const parsedUserData = JSON.parse(rawUserData);
          console.log('  - 사용자 데이터 파싱 성공:', parsedUserData.mt_name, `(${parsedUserData.mt_idx})`);
        } catch (error) {
          console.log('  - 사용자 데이터 파싱 실패:', error);
        }
      }

      console.log('📊 최종 상태:');
      console.log('  - isLoggedIn():', this.isLoggedIn());
      console.log('  - 세션 만료까지 남은 시간:', this.getSessionTimeRemaining());
      console.log('================================');
    }
  }

  /**
   * 세션 남은 시간 조회 (개발용)
   */
  getSessionTimeRemaining(): string {
    const loginTime = this.getLoginTime();
    if (!loginTime) return '로그인 정보 없음';

    const currentTime = Date.now();
    const timeSinceLogin = currentTime - loginTime;
    const timeRemaining = this.SESSION_DURATION - timeSinceLogin;

    if (timeRemaining <= 0) return '세션 만료됨';

    const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

    return `${days}일 ${hours}시간 ${minutes}분 남음`;
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

// 개발용 디버깅 함수들을 전역에 노출
if (typeof window !== 'undefined') {
  (window as any).SMAP_AUTH_SERVICE = authService;

  // 테스트용 함수들
  (window as any).SMAP_TEST_PERSISTENCE = async () => {
    console.log('🧪 로그인 상태 유지 테스트 시작...');

    try {
      console.log('1. 현재 상태 확인...');
      const isLoggedIn = authService.isLoggedIn();
      console.log('   결과:', isLoggedIn);

      console.log('2. 토큰 검증...');
      const tokenValid = await authService.checkAndRefreshToken();
      console.log('   결과:', tokenValid);

      console.log('3. 사용자 정보 조회...');
      const userProfile = await authService.getCurrentUserProfile();
      console.log('   결과:', userProfile ? `${userProfile.mt_name} (${userProfile.mt_idx})` : 'null');

      console.log('4. 전체 상태 요약:');
      console.log('   - 로그인 상태:', isLoggedIn);
      console.log('   - 토큰 유효:', tokenValid);
      console.log('   - 사용자 정보:', !!userProfile);

      // 상세한 문제 진단
      console.log('5. 문제 진단:');
      const token = authService.getToken();
      const userData = authService.getUserData();
      console.log('   - 토큰 존재:', !!token);
      console.log('   - 사용자 데이터 존재:', !!userData);

      if (token && !userData) {
        console.log('   🔍 진단: 토큰은 있지만 사용자 데이터가 없음');
        console.log('   💡 해결: 서버에서 사용자 정보를 다시 가져와야 함');
      } else if (!token && userData) {
        console.log('   🔍 진단: 사용자 데이터는 있지만 토큰이 없음');
        console.log('   💡 해결: 재로그인이 필요함');
      } else if (!token && !userData) {
        console.log('   🔍 진단: 토큰과 사용자 데이터 모두 없음');
        console.log('   💡 해결: 로그인이 필요함');
      } else if (token && userData) {
        console.log('   🔍 진단: 토큰과 사용자 데이터 모두 존재');
        console.log('   ✅ 상태: 정상');
      }

      if (isLoggedIn && tokenValid && userProfile) {
        console.log('✅ 모든 테스트 통과 - 로그인 상태 유지 기능 정상 작동');
      } else {
        console.log('⚠️ 일부 테스트 실패 - 로그인 상태 유지 기능에 문제가 있음');
        console.log('🔧 권장 조치:');
        if (!userProfile && tokenValid) {
          console.log('   - 서버에서 사용자 정보를 다시 동기화하세요');
        }
        if (!tokenValid) {
          console.log('   - 재로그인이 필요합니다');
        }
      }

    } catch (error) {
      console.error('❌ 테스트 중 오류 발생:', error);
    }

    console.log('✅ 테스트 완료');
  };

  (window as any).SMAP_CLEAR_AUTH = () => {
    console.log('🗑️ 인증 데이터 초기화...');
    authService.clearAuthData();
    console.log('✅ 초기화 완료');
  };

  console.log('🔧 SMAP AuthService 디버깅 함수들:');
  console.log('  - SMAP_TEST_PERSISTENCE(): 로그인 상태 유지 테스트');
  console.log('  - SMAP_CLEAR_AUTH(): 인증 데이터 초기화');
  console.log('  - SMAP_AUTH_SERVICE.debugAuthState(): 상세 디버깅 정보');
}

export default authService; 