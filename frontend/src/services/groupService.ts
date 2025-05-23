import apiClient from './apiClient';

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

export interface GroupCreate {
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_show?: 'Y' | 'N' | null;
}

export interface GroupUpdate {
  mt_idx?: number | null;
  sgt_title?: string | null;
  sgt_code?: string | null;
  sgt_show?: 'Y' | 'N' | null;
}

class GroupService {
  // 모든 그룹 목록 조회
  async getAllGroups(skip: number = 0, limit: number = 100): Promise<Group[]> {
    try {
      const response = await apiClient.get(`/groups?skip=${skip}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch all groups:', error);
      throw error;
    }
  }

  // ID로 그룹 조회
  async getGroupById(groupId: number): Promise<Group> {
    try {
      const response = await apiClient.get(`/groups/${groupId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch group ${groupId}:`, error);
      throw error;
    }
  }

  // 특정 멤버의 그룹 목록 조회
  async getMemberGroups(memberId: number): Promise<Group[]> {
    try {
      const response = await apiClient.get(`/v1/groups/member/${memberId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch member groups:', error);
      throw error;
    }
  }

  // 그룹 코드로 그룹 조회
  async getGroupByCode(code: string): Promise<Group> {
    try {
      const response = await apiClient.get(`/groups/code/${code}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch group with code ${code}:`, error);
      throw error;
    }
  }

  // 그룹 생성
  async createGroup(groupData: GroupCreate): Promise<Group> {
    try {
      const response = await apiClient.post('/groups', groupData);
      return response.data;
    } catch (error) {
      console.error('Failed to create group:', error);
      throw error;
    }
  }

  // 그룹 업데이트
  async updateGroup(groupId: number, groupData: GroupUpdate): Promise<Group> {
    try {
      const response = await apiClient.put(`/groups/${groupId}`, groupData);
      return response.data;
    } catch (error) {
      console.error(`Failed to update group ${groupId}:`, error);
      throw error;
    }
  }

  // 그룹 삭제
  async deleteGroup(groupId: number): Promise<Group> {
    try {
      const response = await apiClient.delete(`/groups/${groupId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to delete group ${groupId}:`, error);
      throw error;
    }
  }

  // 현재 로그인한 사용자의 그룹 목록 조회 (임시로 고정 멤버 ID 사용)
  async getCurrentUserGroups(): Promise<Group[]> {
    try {
      // TODO: 실제 로그인한 사용자의 mt_idx를 가져와야 함
      const CURRENT_USER_ID = 1186; // 1에서 1186으로 변경
      return await this.getMemberGroups(CURRENT_USER_ID);
    } catch (error) {
      console.error('Failed to fetch current user groups:', error);
      throw error;
    }
  }
}

const groupService = new GroupService();
export default groupService; 