import { NextRequest, NextResponse } from 'next/server';
import { GroupDetail } from '@/types/auth';

// 멤버가 속한 그룹 상세 정보 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params; // mt_idx

    // TODO: 실제 백엔드 API 호출
    // const response = await axios.get(`http://your-backend-api/group-details/member/${id}`);

    // 임시 Mock 데이터
    const mockGroupDetails: GroupDetail[] = [
      {
        sgdt_idx: 1,
        sgt_idx: 1, // 그룹 ID
        mt_idx: parseInt(id),
        sgdt_owner_chk: 'Y',
        sgdt_leader_chk: 'Y',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: new Date().toISOString(),
        sgdt_udate: new Date().toISOString(),
        sgdt_ddate: '',
        sgdt_xdate: '',
        sgdt_adate: ''
      },
      {
        sgdt_idx: 2,
        sgt_idx: 2, // 다른 그룹 ID
        mt_idx: parseInt(id),
        sgdt_owner_chk: 'N',
        sgdt_leader_chk: 'N',
        sgdt_discharge: 'N',
        sgdt_group_chk: 'Y',
        sgdt_exit: 'N',
        sgdt_show: 'Y',
        sgdt_push_chk: 'Y',
        sgdt_wdate: new Date().toISOString(),
        sgdt_udate: new Date().toISOString(),
        sgdt_ddate: '',
        sgdt_xdate: '',
        sgdt_adate: ''
      }
    ];

    return NextResponse.json(mockGroupDetails);

  } catch (error) {
    console.error('[API] 멤버 그룹 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '멤버의 그룹 상세 정보를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
} 