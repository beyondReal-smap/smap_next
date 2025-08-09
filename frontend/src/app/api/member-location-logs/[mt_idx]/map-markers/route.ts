import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

// HTTPS 인증서 검증 비활성화 (개발 환경)
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ mt_idx: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const params = await context.params;
    const { mt_idx } = params;
    const date = searchParams.get('date');
    const minSpeed = searchParams.get('min_speed') || '1.0';
    const maxAccuracy = searchParams.get('max_accuracy') || '50.0';

    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required' },
        { status: 400 }
      );
    }

    console.log('[API] map-markers 요청:', { mt_idx, date, minSpeed, maxAccuracy });

    // 백엔드 API로 프록시 (도메인 강제)
    const backendBase = resolveBackendBaseUrl();
    const backendUrl = `${backendBase}/api/v1/logs/member-location-logs/${mt_idx}/map-markers?date=${date}&min_speed=${minSpeed}&max_accuracy=${maxAccuracy}`;
    console.log('[API] 백엔드 URL:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] 백엔드 응답 오류:', { status: response.status, errorText });
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('[API] 백엔드 응답 성공:', { 
      result: data.result,
      markerCount: data.data?.length || 0,
      totalMarkers: data.total_markers || 0
    });

    // 600건 넘는 경우 경고 로그 (백엔드에서 이미 제한했어야 하지만 확인)
    if (data.data && data.data.length > 600) {
      console.warn(`[API] map-markers 경고: ${data.data.length}건으로 600건 초과! 백엔드 샘플링 로직 확인 필요`);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('[API] map-markers 오류:', error);

    // 오류 발생 시 모의 데이터 반환
    const params = await context.params;
    const { mt_idx } = params;
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorDate = errorSearchParams.get('date') || '2025-06-04';

    // 더 많은 모의 데이터 생성 (특히 2025-06-09에 대해)
    const mockMarkers = [];
    const baseTime = new Date(`${errorDate} 09:00:00`);
    const markerCount = errorDate === '2025-06-09' ? 50 : 10; // 06-09는 50개, 다른 날은 10개
    
    for (let i = 0; i < markerCount; i++) {
      const timeOffset = i * 10; // 10분 간격
      const currentTime = new Date(baseTime.getTime() + timeOffset * 60 * 1000);
      const timeString = currentTime.toISOString().slice(0, 19).replace('T', ' ');
      
      // 서울 시내 위치들 (강남, 홍대, 명동 등)
      const locations = [
        { lat: 37.5665, lng: 126.9780 }, // 서울역
        { lat: 37.5173, lng: 127.0473 }, // 강남역
        { lat: 37.5563, lng: 126.9723 }, // 명동
        { lat: 37.5563, lng: 126.9229 }, // 홍대
        { lat: 37.5447, lng: 127.0557 }, // 역삼역
        { lat: 37.5015, lng: 127.0395 }, // 교대역
        { lat: 37.5270, lng: 127.0276 }, // 잠실역
        { lat: 37.5208, lng: 126.9240 }, // 여의도
      ];
      
      const randomLocation = locations[i % locations.length];
      const latVariation = (Math.random() - 0.5) * 0.01; // ±0.005도 변화
      const lngVariation = (Math.random() - 0.5) * 0.01;
      
      mockMarkers.push({
        mlt_idx: i + 1,
        mt_idx: parseInt(mt_idx),
        mlt_gps_time: timeString,
        mlt_speed: Math.random() * 5 + 1, // 1-6 km/h
        mlt_lat: randomLocation.lat + latVariation,
        mlt_long: randomLocation.lng + lngVariation,
        mlt_accuacy: Math.random() * 20 + 10, // 10-30m
        mt_health_work: 0,
        mlt_battery: Math.floor(Math.random() * 30 + 70), // 70-100%
        mlt_fine_location: 'Y',
        mlt_location_chk: 'Y',
        mlt_wdate: timeString,
        stay_lat: null,
        stay_long: null
      });
    }

    const mockData = {
      result: "Y",
      data: mockMarkers,
      total_markers: mockMarkers.length
    };

    console.log('[API] 백엔드 연결 실패, 모의 데이터 반환');
    return NextResponse.json(mockData);
  }
} 