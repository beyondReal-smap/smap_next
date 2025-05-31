import apiClient from './apiClient';
import { Member, Group, GroupDetail, GroupWithMembers, UserProfile, LoginRequest, LoginResponse } from '@/types/auth';

class AuthService {
  private readonly TOKEN_KEY = 'smap_auth_token';
  private readonly USER_KEY = 'smap_user_data';

  /**
   * 로그인
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      
      if (response.data.success && response.data.data) {
        // 토큰 저장 (token이 있는 경우에만)
        if (response.data.data.token) {
          this.setToken(response.data.data.token);
        }
        // 사용자 전체 정보 조회 및 저장
        const userProfile = await this.getUserProfile(response.data.data.member.mt_idx);
        this.setUserData(userProfile);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('[AUTH SERVICE] 로그인 실패:', error);
      throw new Error(error.response?.data?.message || '로그인에 실패했습니다.');
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
   * 사용자 전체 프로필 조회 (사용자 정보 + 그룹 정보)
   */
  async getUserProfile(mt_idx: number): Promise<UserProfile> {
    try {
      // 1. 사용자 기본 정보 조회
      const memberResponse = await apiClient.get<Member>(`/members/${mt_idx}`);
      const member = memberResponse.data;

      // 2. 사용자가 속한 그룹들 조회
      const groups = await this.getUserGroups(mt_idx);

      // 3. 소유 그룹과 참여 그룹 분리
      const ownedGroups = groups.filter(group => group.myRole.isOwner);
      const joinedGroups = groups.filter(group => !group.myRole.isOwner);

      return {
        ...member,
        groups,
        ownedGroups,
        joinedGroups
      };
    } catch (error) {
      console.error('[AUTH SERVICE] 사용자 프로필 조회 실패:', error);
      throw new Error('사용자 정보를 불러올 수 없습니다.');
    }
  }

  /**
   * 사용자가 속한 그룹들 조회
   */
  async getUserGroups(mt_idx: number): Promise<GroupWithMembers[]> {
    try {
      // 1. 사용자가 속한 그룹 상세 정보 조회
      const groupDetailsResponse = await apiClient.get<GroupDetail[]>(`/group-details/member/${mt_idx}`);
      const groupDetails = groupDetailsResponse.data.filter(
        detail => detail.sgdt_show === 'Y' && detail.sgdt_exit === 'N' && detail.sgdt_discharge === 'N'
      );

      // 2. 각 그룹의 기본 정보와 멤버 정보 조회
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
    }
  }

  /**
   * 토큰 조회
   */
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.TOKEN_KEY);
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
    }
  }

  /**
   * 로그인 상태 확인
   */
  isLoggedIn(): boolean {
    const token = this.getToken();
    const userData = this.getUserData();
    return !!(token && userData);
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
}

// 싱글톤 인스턴스 생성
const authService = new AuthService();
export default authService; 