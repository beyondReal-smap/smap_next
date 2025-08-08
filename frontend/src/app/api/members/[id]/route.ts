import { NextRequest, NextResponse } from 'next/server';
import { Member } from '@/types/auth';

// 실제 백엔드 API 호출 함수
async function fetchWithFallback(url: string): Promise<any> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    // SSL 인증서 문제 해결을 위한 설정
    // @ts-ignore
    rejectUnauthorized: false
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// 사용자별 Mock 데이터 - 실제 백엔드 데이터에 맞춰 수정 (백엔드 실패 시 사용)
const mockMembers: Record<string, Member> = {
  '1186': {
    mt_idx: 1186,
    mt_type: 1,
    mt_level: 2,
    mt_status: 1,
    mt_id: '01012345678',
    mt_name: 'jin',
    mt_nickname: 'jin',
    mt_hp: '01012345678',
    mt_email: 'jin@example.com',
    mt_birth: '1982-02-11', // 실제 백엔드 데이터에 맞춤
    mt_gender: 1,
    mt_file1: '/images/male_1.png',
    mt_lat: 37.51869,
    mt_long: 126.88498,
    mt_sido: '서울시',
    mt_gu: '강남구',
    mt_dong: '역삼동',
    mt_onboarding: 'Y',
    mt_push1: 'Y',
    mt_plan_check: 'N',
    mt_plan_date: '',
    mt_weather_pop: '30%', // 실제 데이터에 맞춤
    mt_weather_sky: 1, // 실제 데이터에 맞춤
    mt_weather_tmn: 22, // 실제 데이터에 맞춤
    mt_weather_tmx: 30, // 실제 데이터에 맞춤
    mt_weather_date: new Date().toISOString(),
    mt_ldate: new Date().toISOString(),
    mt_adate: new Date().toISOString()
  },
  '1194': {
    mt_idx: 1194,
    mt_type: 1,
    mt_level: 2,
    mt_status: 1,
    mt_id: '01023456789',
    mt_name: 'sil',
    mt_nickname: 'sil',
    mt_hp: '01023456789',
    mt_email: 'sil@example.com',
    mt_birth: '1992-05-15',
    mt_gender: 2,
    mt_file1: '/images/female_1.png',
    mt_lat: 37.56824896258384,
    mt_long: 126.99845912711855,
    mt_sido: '서울시',
    mt_gu: '중구',
    mt_dong: '명동',
    mt_onboarding: 'Y',
    mt_push1: 'Y',
    mt_plan_check: 'N',
    mt_plan_date: '',
    mt_weather_pop: '20',
    mt_weather_sky: 8,
    mt_weather_tmn: 18,
    mt_weather_tmx: 25,
    mt_weather_date: new Date().toISOString(),
    mt_ldate: new Date().toISOString(),
    mt_adate: new Date().toISOString()
  },
  '1200': {
    mt_idx: 1200,
    mt_type: 1,
    mt_level: 2,
    mt_status: 1,
    mt_id: '01034567890',
    mt_name: 'eun',
    mt_nickname: 'eun',
    mt_hp: '01034567890',
    mt_email: 'eun@example.com',
    mt_birth: '1988-12-03',
    mt_gender: 2,
    mt_file1: '/images/female_2.png',
    mt_lat: 37.562974596045585,
    mt_long: 127.00331637880045,
    mt_sido: '서울시',
    mt_gu: '중구',
    mt_dong: '을지로',
    mt_onboarding: 'Y',
    mt_push1: 'Y',
    mt_plan_check: 'N',
    mt_plan_date: '',
    mt_weather_pop: '20',
    mt_weather_sky: 8,
    mt_weather_tmn: 18,
    mt_weather_tmx: 25,
    mt_weather_date: new Date().toISOString(),
    mt_ldate: new Date().toISOString(),
    mt_adate: new Date().toISOString()
  },
  '282': {
    mt_idx: 282,
    mt_type: 1,
    mt_level: 2,
    mt_status: 1,
    mt_id: '01045678901',
    mt_name: 'yeon',
    mt_nickname: 'yeon',
    mt_hp: '01045678901',
    mt_email: 'yeon@example.com',
    mt_birth: '1995-08-20',
    mt_gender: 2,
    mt_file1: '/images/female_3.png',
    mt_lat: 37.5186,
    mt_long: 126.88497,
    mt_sido: '서울시',
    mt_gu: '강남구',
    mt_dong: '역삼동',
    mt_onboarding: 'Y',
    mt_push1: 'Y',
    mt_plan_check: 'N',
    mt_plan_date: '',
    mt_weather_pop: '20',
    mt_weather_sky: 8,
    mt_weather_tmn: 18,
    mt_weather_tmx: 25,
    mt_weather_date: new Date().toISOString(),
    mt_ldate: new Date().toISOString(),
    mt_adate: new Date().toISOString()
  }
};

// 멤버 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log('[Members API] 멤버 조회 요청:', { id });

    // 실제 백엔드 API 호출 시도
    try {
      const backendUrl = `https://api3.smap.site/api/v1/members/${id}`;
      console.log('[Members API] 백엔드 API 호출:', backendUrl);
      
      const memberData = await fetchWithFallback(backendUrl);
      console.log('[Members API] 백엔드 응답 성공:', { 
        mt_idx: memberData.mt_idx,
        mt_name: memberData.mt_name,
        mt_birth: memberData.mt_birth
      });
      
      return NextResponse.json(memberData, {
        headers: {
          'X-Data-Source': 'backend-real',
          'X-Backend-URL': backendUrl
        }
      });
    } catch (backendError) {
      console.warn('[Members API] 백엔드 API 호출 실패, Mock 데이터 사용:', backendError);
      
      // Mock 데이터에서 해당 ID의 사용자 찾기
      const mockMember = mockMembers[id];
      
      if (!mockMember) {
        // 해당 ID의 사용자가 없으면 기본 사용자 반환
        const defaultMember: Member = {
          mt_idx: parseInt(id),
          mt_type: 1,
          mt_level: 2,
          mt_status: 1,
          mt_id: `user${id}`,
          mt_name: `user${id}`,
          mt_nickname: `user${id}`,
          mt_hp: '01012345678',
          mt_email: `user${id}@example.com`,
          mt_birth: '1990-01-01',
          mt_gender: 1,
          mt_file1: '/images/male_1.png',
          mt_lat: 37.5642,
          mt_long: 127.0016,
          mt_sido: '서울시',
          mt_gu: '강남구',
          mt_dong: '역삼동',
          mt_onboarding: 'Y',
          mt_push1: 'Y',
          mt_plan_check: 'N',
          mt_plan_date: '',
          mt_weather_pop: '20',
          mt_weather_sky: 8,
          mt_weather_tmn: 18,
          mt_weather_tmx: 25,
          mt_weather_date: new Date().toISOString(),
          mt_ldate: new Date().toISOString(),
          mt_adate: new Date().toISOString()
        };
        return NextResponse.json(defaultMember, {
          headers: {
            'X-Data-Source': 'mock-default'
          }
        });
      }

      return NextResponse.json(mockMember, {
        headers: {
          'X-Data-Source': 'mock-predefined'
        }
      });
    }

  } catch (error) {
    console.error('[Members API] 멤버 조회 오류:', error);
    return NextResponse.json(
      { error: '멤버 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}

// 멤버 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updateData = await request.json();
    
    console.log('[Members API] 멤버 업데이트 요청:', { id, updateData });

    // 실제 백엔드 API 호출 시도
    try {
      const backendUrl = `https://api3.smap.site/api/v1/members/${id}`;
      console.log('[Members API] 백엔드 업데이트 API 호출:', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
        // SSL 인증서 문제 해결을 위한 설정
        // @ts-ignore
        rejectUnauthorized: false
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedMemberData = await response.json();
      console.log('[Members API] 백엔드 업데이트 응답 성공:', { 
        mt_idx: updatedMemberData.mt_idx,
        mt_name: updatedMemberData.mt_name
      });
      
      return NextResponse.json(updatedMemberData, {
        headers: {
          'X-Data-Source': 'backend-real',
          'X-Backend-URL': backendUrl
        }
      });
    } catch (backendError) {
      console.warn('[Members API] 백엔드 업데이트 API 호출 실패, Mock 데이터 사용:', backendError);
      
      // 기존 사용자 데이터 가져오기
      const existingMember = mockMembers[id];
      
      // 임시 로직 - 업데이트된 데이터 반환
      const updatedMember: Member = {
        ...(existingMember || {
          mt_idx: parseInt(id),
          mt_type: 1,
          mt_level: 2,
          mt_status: 1,
          mt_id: `user${id}`,
          mt_name: `user${id}`,
          mt_nickname: `user${id}`,
          mt_hp: '01012345678',
          mt_email: `user${id}@example.com`,
          mt_birth: '1990-01-01',
          mt_gender: 1,
          mt_file1: '/images/male_1.png',
          mt_lat: 37.5642,
          mt_long: 127.0016,
          mt_sido: '서울시',
          mt_gu: '강남구',
          mt_dong: '역삼동',
          mt_onboarding: 'Y',
          mt_push1: 'Y',
          mt_plan_check: 'N',
          mt_plan_date: '',
          mt_weather_pop: '20',
          mt_weather_sky: 8,
          mt_weather_tmn: 18,
          mt_weather_tmx: 25,
          mt_weather_date: new Date().toISOString(),
          mt_ldate: new Date().toISOString(),
          mt_adate: new Date().toISOString()
        }),
        ...updateData, // 업데이트 데이터로 덮어쓰기
        mt_ldate: new Date().toISOString() // 수정일시 업데이트
      };

      // Mock 데이터 업데이트
      mockMembers[id] = updatedMember;

      return NextResponse.json(updatedMember, {
        headers: {
          'X-Data-Source': 'mock-updated'
        }
      });
    }

  } catch (error) {
    console.error('[Members API] 멤버 업데이트 오류:', error);
    return NextResponse.json(
      { error: '멤버 정보 업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }
} 