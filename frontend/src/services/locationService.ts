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
      const response = await apiClient.get<LocationDataFromApi[]>(`/locations/other-members/${memberId}`);
      console.log(`[locationService] 멤버 ${memberId}의 원본 데이터:`, response.data);
      
      return response.data.map((item) => {
        const converted = {
          id: String(item.slt_idx),
          name: item.slt_title || '제목 없음',
          address: item.slt_add || '주소 없음',
          coordinates: [
            parseFloat(item.slt_long || '0'), 
            parseFloat(item.slt_lat || '0')
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
        console.log(`[locationService] 변환된 데이터:`, { 원본: item, 변환후: converted });
        return converted;
      });
    } catch (error) {
      console.error('Error fetching other members locations:', error);
      return [];
    }
  },

  // 여기에 다른 장소 관련 API 호출 함수들을 추가할 수 있습니다.
  // 예: getMyLocations, createLocation, updateLocation, deleteLocation 등
};

export default locationService; 