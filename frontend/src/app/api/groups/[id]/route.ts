import { NextRequest, NextResponse } from 'next/server';
import { Group } from '@/types/auth';

// 그룹 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.get(`http://your-backend-api/groups/${id}`);

    // 임시 Mock 데이터
    const mockGroup: Group = {
      sgt_idx: parseInt(id),
      mt_idx: 1186, // 오너 ID
      sgt_title: `테스트 그룹 ${id}`,
      sgt_code: `GROUP${id}`,
      sgt_show: 'Y',
      sgt_wdate: new Date().toISOString(),
      sgt_udate: new Date().toISOString()
    };

    return NextResponse.json(mockGroup);

  } catch (error) {
    console.error('[API] 그룹 조회 오류:', error);
    return NextResponse.json(
      { error: '그룹 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
} 