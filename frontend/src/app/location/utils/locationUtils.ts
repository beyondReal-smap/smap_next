// 위치 관련 유틸리티 함수들

// 좌표 간 거리 계산 (미터 단위)
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371e3; // 지구 반지름 (미터)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// 거리를 사람이 읽기 쉬운 형태로 변환
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
};

// 좌표가 유효한지 확인
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

// 주소에서 좌표 추출 (간단한 정규식)
export const extractCoordinatesFromAddress = (address: string): [number, number] | null => {
  // 위도,경도 형태의 주소에서 좌표 추출
  const coordPattern = /(-?\d+\.\d+),?\s*(-?\d+\.\d+)/;
  const match = address.match(coordPattern);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    if (isValidCoordinate(lat, lng)) {
      return [lat, lng];
    }
  }
  
  return null;
};

// 좌표를 주소 형태로 변환
export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

// 카테고리별 색상 반환
export const getCategoryColor = (category: string): string => {
  const colors: { [key: string]: string } = {
    음식점: 'bg-red-500',
    카페: 'bg-yellow-500',
    쇼핑: 'bg-blue-500',
    교통: 'bg-green-500',
    의료: 'bg-purple-500',
    기타: 'bg-gray-500'
  };
  
  return colors[category] || colors.기타;
};

// 카테고리별 아이콘 반환
export const getCategoryIcon = (category: string): string => {
  const icons: { [key: string]: string } = {
    음식점: '🍽️',
    카페: '☕',
    쇼핑: '🛍️',
    교통: '🚇',
    의료: '🏥',
    기타: '📍'
  };
  
  return icons[category] || icons.기타;
};

// 위치 데이터 검증
export const validateLocationData = (location: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!location.name || location.name.trim().length === 0) {
    errors.push('위치 이름은 필수입니다.');
  }
  
  if (!location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    errors.push('유효한 좌표가 필요합니다.');
  } else {
    const [lat, lng] = location.coordinates;
    if (!isValidCoordinate(lat, lng)) {
      errors.push('좌표가 유효하지 않습니다.');
    }
  }
  
  if (location.name && location.name.trim().length > 100) {
    errors.push('위치 이름은 100자 이하여야 합니다.');
  }
  
  if (location.memo && location.memo.length > 500) {
    errors.push('메모는 500자 이하여야 합니다.');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// 위치 데이터 정규화
export const normalizeLocationData = (location: any): any => {
  return {
    id: location.id || '',
    name: location.name?.trim() || '',
    address: location.address?.trim() || '',
    coordinates: location.coordinates || [0, 0],
    category: location.category || '기타',
    memo: location.memo?.trim() || '',
    favorite: Boolean(location.favorite),
    notifications: location.notifications !== false,
    createdAt: location.createdAt || new Date().toISOString(),
    updatedAt: location.updatedAt || new Date().toISOString()
  };
};

// 위치 데이터 비교 (동일한 위치인지 확인)
export const isSameLocation = (loc1: any, loc2: any, threshold: number = 50): boolean => {
  if (!loc1.coordinates || !loc2.coordinates) return false;
  
  const [lat1, lng1] = loc1.coordinates;
  const [lat2, lng2] = loc2.coordinates;
  
  const distance = calculateDistance(lat1, lng1, lat2, lng2);
  return distance <= threshold; // 50m 이내면 같은 위치로 간주
};

// 위치 목록을 거리순으로 정렬
export const sortLocationsByDistance = (
  locations: any[],
  centerLat: number,
  centerLng: number
): any[] => {
  return [...locations].sort((a, b) => {
    if (!a.coordinates || !b.coordinates) return 0;
    
    const [latA, lngA] = a.coordinates;
    const [latB, lngB] = b.coordinates;
    
    const distanceA = calculateDistance(centerLat, centerLng, latA, lngA);
    const distanceB = calculateDistance(centerLat, centerLng, latB, lngB);
    
    return distanceA - distanceB;
  });
};

// 위치 데이터를 CSV 형태로 변환
export const exportLocationsToCSV = (locations: any[]): string => {
  const headers = ['이름', '주소', '위도', '경도', '카테고리', '메모', '즐겨찾기', '알림'];
  
  const csvRows = [
    headers.join(','),
    ...locations.map(location => [
      `"${location.name || ''}"`,
      `"${location.address || ''}"`,
      location.coordinates?.[0] || '',
      location.coordinates?.[1] || '',
      `"${location.category || ''}"`,
      `"${location.memo || ''}"`,
      location.favorite ? 'Y' : 'N',
      location.notifications !== false ? 'Y' : 'N'
    ].join(','))
  ];
  
  return csvRows.join('\n');
};

// 위치 데이터를 JSON 형태로 변환
export const exportLocationsToJSON = (locations: any[]): string => {
  return JSON.stringify(locations, null, 2);
};

// 위치 검색 (간단한 텍스트 검색)
export const searchLocations = (
  locations: any[],
  query: string,
  searchFields: string[] = ['name', 'address', 'memo', 'category']
): any[] => {
  if (!query.trim()) return locations;
  
  const searchTerm = query.toLowerCase().trim();
  
  return locations.filter(location => {
    return searchFields.some(field => {
      const value = location[field];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchTerm);
      }
      return false;
    });
  });
};

// 위치 데이터 통계
export const getLocationStats = (locations: any[]): {
  total: number;
  byCategory: { [key: string]: number };
  favorites: number;
  withNotifications: number;
} => {
  const stats = {
    total: locations.length,
    byCategory: {} as { [key: string]: number },
    favorites: 0,
    withNotifications: 0
  };
  
  locations.forEach(location => {
    // 카테고리별 개수
    const category = location.category || '기타';
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    
    // 즐겨찾기 개수
    if (location.favorite) {
      stats.favorites++;
    }
    
    // 알림 설정 개수
    if (location.notifications !== false) {
      stats.withNotifications++;
    }
  });
  
  return stats;
};
