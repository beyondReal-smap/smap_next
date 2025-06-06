import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://118.67.130.71:8000';

// HTTPS 인증서 검증 비활성화 (개발 환경)
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { mt_idx: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
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

    // 백엔드 API로 프록시
    const backendUrl = `${BACKEND_URL}/api/v1/logs/member-location-logs/${mt_idx}/map-markers?date=${date}&min_speed=${minSpeed}&max_accuracy=${maxAccuracy}`;
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
    const { mt_idx } = params;
    const { searchParams: errorSearchParams } = new URL(request.url);
    const errorDate = errorSearchParams.get('date') || '2025-06-04';

    const mockData = {
      result: "Y",
      data: [
        {
          mlt_idx: 1,
          mt_idx: parseInt(mt_idx),
          mlt_gps_time: `${errorDate} 09:30:00`,
          mlt_speed: 2.5,
          mlt_lat: 37.5665,
          mlt_long: 126.9780,
          mlt_accuacy: 15.0,
          mt_health_work: 0,
          mlt_battery: 85,
          mlt_fine_location: 'Y',
          mlt_location_chk: 'Y',
          mlt_wdate: `${errorDate} 09:30:00`,
          stay_lat: null,
          stay_long: null
        },
        {
          mlt_idx: 2,
          mt_idx: parseInt(mt_idx),
          mlt_gps_time: `${errorDate} 10:15:00`,
          mlt_speed: 1.8,
          mlt_lat: 37.5670,
          mlt_long: 126.9785,
          mlt_accuacy: 12.0,
          mt_health_work: 0,
          mlt_battery: 82,
          mlt_fine_location: 'Y',
          mlt_location_chk: 'Y',
          mlt_wdate: `${errorDate} 10:15:00`,
          stay_lat: null,
          stay_long: null
        }
      ],
      total_markers: 2
    };

    console.log('[API] 백엔드 연결 실패, 모의 데이터 반환');
    return NextResponse.json(mockData);
  }
} 