import apiClient from './apiClient';
// LocationData 인터페이스는 frontend/src/app/location/page.tsx 또는 유사한 경로에서 가져오거나,
// 아래와 같이 직접 정의할 수 있습니다.
// 백엔드의 LocationResponse 스키마와 필드가 일치해야 하며, 필요시 매핑합니다.

export interface LocationDataFromApi {
  slt_idx: number;
  insert_mt_idx?: number | null;
  mt_idx?: number | null;
  sgdt_idx?: number | null;
  slt_title?: string | null;
  slt_add?: string | null;
  slt_lat?: string | null; // Decimal은 문자열로 올 수 있음
  slt_long?: string | null; // Decimal은 문자열로 올 수 있음
  slt_show?: string | null; // Enum은 문자열로
  slt_enter_alarm?: string | null;
  slt_enter_chk?: string | null;
  slt_wdate?: string | null;
  slt_udate?: string | null;
  slt_ddate?: string | null;
  // 프론트엔드에서 사용하는 추가적인 필드가 있다면 여기에 정의하거나, 매핑 시 생성
  // 예: category, memo, favorite, notifications 등은 LocationResponse에 없을 수 있음
}

// 프론트엔드 LocationPage에서 사용하는 LocationData 타입 (조정 필요할 수 있음)
export interface LocationPageData {
  id: string;
  name: string;
  address: string;
  category: string;
  coordinates: [number, number]; // [lng, lat]
  memo: string;
  favorite: boolean;
  notifications?: boolean;
}

// OtherMemberLocationRaw 인터페이스 정의 및 내보내기 추가
export interface OtherMemberLocationRaw {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  category: string;
  memo: string;
  favorite: boolean;
  notifications?: boolean;
  // 백엔드 필드와 매핑을 위한 추가 필드 (null 허용)
  slt_idx?: number | string;
  slt_title?: string | null;
  slt_add?: string | null;
  slt_lat?: string | null;
  slt_long?: string | null;
  slt_enter_alarm?: string | null;
}

const locationService = {
  getOtherMembersLocations: async (memberId: string): Promise<OtherMemberLocationRaw[]> => {
    try {
      console.log(`[locationService] API 호출 시작 - 멤버 ID: ${memberId}, URL: /locations/other-members/${memberId}`);
      const response = await apiClient.get<LocationDataFromApi[]>(`/locations/other-members/${memberId}`);
      console.log(`[locationService] API 응답 상태:`, response.status);
      console.log(`[locationService] 멤버 ${memberId}의 원본 응답 데이터:`, response.data);
      
      // 각 아이템의 slt_enter_alarm 필드를 개별적으로 확인
      response.data.forEach((item, index) => {
        console.log(`[locationService] ${index + 1}번째 아이템 slt_enter_alarm:`, {
          slt_idx: item.slt_idx,
          slt_title: item.slt_title,
          slt_enter_alarm: item.slt_enter_alarm,
          hasEnterAlarmField: 'slt_enter_alarm' in item,
          enterAlarmType: typeof item.slt_enter_alarm
        });
      });
      
      return response.data.map((item, index) => {
        const converted = {
        id: String(item.slt_idx),
        name: item.slt_title || '제목 없음',
        address: item.slt_add || '주소 없음',
        coordinates: [
          parseFloat(item.slt_lat || '0'),   // 🚨 위도(latitude)를 먼저
          parseFloat(item.slt_long || '0')   // 🚨 경도(longitude)를 나중에
        ] as [number, number],
        category: '기타', // 백엔드 응답에 category 필드가 있다면 사용 (예: item.slt_category)
        memo: '', // 백엔드 응답에 memo 필드가 있다면 사용 (예: item.slt_memo)
        favorite: false, // 백엔드 응답에 favorite(bookmark) 필드가 있다면 사용
          notifications: item.slt_enter_alarm === 'Y', // slt_enter_alarm을 notifications로 매핑
          // 백엔드 원본 필드 유지
          slt_idx: item.slt_idx,
          slt_title: item.slt_title,
          slt_add: item.slt_add,
          slt_lat: item.slt_lat,
          slt_long: item.slt_long,
          slt_enter_alarm: item.slt_enter_alarm,
        };
        console.log(`[locationService] ${index + 1}번째 변환 결과:`, { 
          원본_slt_enter_alarm: item.slt_enter_alarm, 
          변환후_notifications: converted.notifications,
          전체_변환후: converted 
        });
        return converted;
      });
    } catch (error) {
      console.error('Error fetching other members locations:', error);
      return [];
    }
  },

  // 장소 알림 설정 업데이트
  updateLocationNotification: async (sltIdx: number, notifications: boolean): Promise<void> => {
    try {
      console.log(`[locationService] 알림 설정 업데이트 API 호출 - slt_idx: ${sltIdx}, notifications: ${notifications}`);
      const response = await apiClient.patch(`/locations/${sltIdx}/notification`, {
        slt_enter_alarm: notifications ? 'Y' : 'N'
      });
      console.log(`[locationService] 알림 설정 업데이트 성공:`, response.status);
    } catch (error) {
      console.error('Error updating location notification:', error);
      throw error;
    }
  },

  // 장소 숨김 처리 (기존 deleteLocation 대체)
  hideLocation: async (sltIdx: number): Promise<void> => {
    try {
      console.log(`[locationService] 장소 숨김 처리 API 호출 - slt_idx: ${sltIdx}`);
      // 프론트엔드 API 라우트 ([locationId]/route.ts)가 PATCH로 되어 있으므로 apiClient.patch 사용
      const response = await apiClient.patch(`/locations/${sltIdx}`); 
      console.log(`[locationService] 장소 숨김 처리 성공:`, response.status);
    } catch (error) {
      console.error('Error hiding location:', error);
      throw error;
    }
  },

  // 장소 완전 삭제 (실제 삭제 API 호출)
  deleteLocation: async (sltIdx: number): Promise<void> => {
    try {
      console.log(`[locationService] 장소 삭제 API 호출 - slt_idx: ${sltIdx}`);
      
      // Next.js API 라우트를 통해 삭제 요청 (프록시 방식)
      const response = await apiClient.delete(`/locations/${sltIdx}`);
      console.log(`[locationService] 장소 삭제 성공:`, response.status, response.data);
      
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  },

  // 새 장소 생성
  createLocation: async (locationData: any): Promise<any> => {
    try {
      console.log(`[locationService] 장소 생성 API 호출:`, locationData);
      const response = await apiClient.post('/locations/create', locationData);
      console.log(`[locationService] 장소 생성 성공:`, response.status, response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  },

  // 멤버별 새 장소 생성
  createMemberLocation: async (memberId: number, locationData: any): Promise<any> => {
    try {
      console.log(`[locationService] 멤버 ${memberId} 장소 생성 API 호출:`, locationData);
      
      // 멤버 ID를 데이터에 포함
      const dataWithMember = {
        ...locationData,
        mt_idx: memberId,
        insert_mt_idx: memberId
      };
      
      const response = await apiClient.post('/locations/create', dataWithMember);
      console.log(`[locationService] 멤버 ${memberId} 장소 생성 성공:`, response.status, response.data);
      return response.data;
    } catch (error) {
      console.error(`Error creating location for member ${memberId}:`, error);
      throw error;
    }
  },

  // 여기에 다른 장소 관련 API 호출 함수들을 추가할 수 있습니다.
  // 예: getMyLocations, updateLocation 등
};

export default locationService; 