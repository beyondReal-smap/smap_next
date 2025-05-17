import apiClient from './apiClient';

export interface Member {
  mt_idx: number;
  mt_name: string;
  mt_file1?: string;
  mt_lat?: string;
  mt_long?: string;
  mt_hp?: string;
  mt_email?: string;
  mt_level?: number;
  mt_regdate?: string;
  mt_wdate?: string;
  mt_status?: string;
}

class MemberService {
  /**
   * 모든 멤버 조회
   */
  async getAllMembers(): Promise<Member[]> {
    const mockData: Member[] = [
      {
        mt_idx: 1,
        mt_name: '김철수',
        mt_file1: '/images/avatar1.png',
        mt_lat: '37.5692',
        mt_long: '127.0036'
      },
      {
        mt_idx: 2,
        mt_name: '이영희',
        mt_file1: '/images/avatar2.png',
        mt_lat: '37.5612',
        mt_long: '126.9966'
      },
    ];
    
    try {
      const response = await apiClient.get<Member[]>('/members');
      return response.data;
    } catch (error) {
      console.log('서버 API 호출 실패, 목 데이터 반환:', error);
      return mockData;
    }
  }

  /**
   * ID로 멤버 조회
   */
  async getMemberById(id: number | string): Promise<Member> {
    const mockData: Member = {
      mt_idx: 1,
      mt_name: '김철수',
      mt_file1: '/images/avatar1.png',
      mt_lat: '37.5692',
      mt_long: '127.0036'
    };
    
    try {
      const response = await apiClient.get<Member>(`/members/${id}`);
      return response.data;
    } catch (error) {
      console.log('서버 API 호출 실패, 목 데이터 반환:', error);
      return mockData;
    }
  }

  /**
   * 그룹 멤버 조회
   */
  async getGroupMembers(groupId: number | string): Promise<Member[]> {
    const mockData: Member[] = [
      {
        mt_idx: 1,
        mt_name: '김철수',
        mt_file1: '/images/avatar1.png',
        mt_lat: '37.5692',
        mt_long: '127.0036'
      },
      {
        mt_idx: 2,
        mt_name: '이영희',
        mt_file1: '/images/avatar2.png',
        mt_lat: '37.5612',
        mt_long: '126.9966'
      },
      {
        mt_idx: 3,
        mt_name: '박민수',
        mt_file1: '/images/avatar3.png',
        mt_lat: '37.5662',
        mt_long: '126.9986'
      }
    ];
    
    try {
      console.log('[MEMBER SERVICE] 그룹 멤버 조회 시작:', groupId);
      const response = await apiClient.get<Member[]>(`/group-members/member/${groupId}`);
      console.log('[MEMBER SERVICE] 그룹 멤버 조회 응답:', response.data);
      return response.data;
    } catch (error) {
      console.error('[MEMBER SERVICE] 서버 API 호출 실패, 목 데이터 반환:', error);
      return mockData;
    }
  }

  /**
   * 멤버 추가
   */
  async addMember(memberData: Partial<Member>): Promise<Member> {
    const response = await apiClient.post<Member>('/members', memberData);
    return response.data;
  }

  /**
   * 멤버 정보 업데이트
   */
  async updateMember(id: number | string, memberData: Partial<Member>): Promise<Member> {
    const response = await apiClient.put<Member>(`/members/${id}`, memberData);
    return response.data;
  }

  /**
   * 멤버 삭제
   */
  async deleteMember(id: number | string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/members/${id}`);
    return response.data;
  }

  /**
   * 멤버 위치 정보 업데이트
   */
  async updateMemberLocation(id: number | string, lat: number, lng: number): Promise<Member> {
    const response = await apiClient.patch<Member>(`/members/${id}/location`, { mt_lat: lat, mt_long: lng });
    return response.data;
  }
}

// 싱글톤 인스턴스 생성
const memberService = new MemberService();
export default memberService; 