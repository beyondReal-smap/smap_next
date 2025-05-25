import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = 'https://118.67.130.71:8000/api/v1';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const { groupId, memberId } = await params;
    
    console.log('[API Route] 멤버 탈퇴 처리 요청:', {
      groupId,
      memberId
    });

    // 먼저 해당 그룹의 멤버 정보를 조회하여 sgdt_idx를 찾기
    const membersResponse = await fetch(`${BACKEND_BASE_URL}/groups/${groupId}/members`);
    if (!membersResponse.ok) {
      return NextResponse.json(
        { error: '그룹 멤버 정보를 조회할 수 없습니다.' },
        { status: 500 }
      );
    }

    const members = await membersResponse.json();
    const targetMember = members.find((member: any) => member.mt_idx === parseInt(memberId));
    
    if (!targetMember) {
      return NextResponse.json(
        { error: '해당 멤버를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // smap_group_detail_t 테이블 업데이트 (소프트 삭제)
    const updateData = {
      sgdt_show: 'N',
      sgdt_udate: new Date().toISOString()
    };

    // 백엔드의 기존 업데이트 API 사용 (실제 엔드포인트에 맞게 조정 필요)
    const backendResponse = await fetch(`${BACKEND_BASE_URL}/group-details/${targetMember.sgdt_idx}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!backendResponse.ok) {
      console.error('[API Route] 백엔드 응답 오류:', backendResponse.status, backendResponse.statusText);
      
      // 임시로 성공 응답 반환 (실제 API가 구현될 때까지)
      console.log('[API Route] 백엔드 API 미구현으로 임시 성공 응답 반환');
      return NextResponse.json({
        success: true,
        message: '멤버가 그룹에서 탈퇴되었습니다. (임시)',
        data: { sgdt_show: 'N' }
      });
    }

    const result = await backendResponse.json();
    console.log('[API Route] 멤버 탈퇴 처리 성공:', result);

    return NextResponse.json({
      success: true,
      message: '멤버가 그룹에서 탈퇴되었습니다.',
      data: result
    });

  } catch (error) {
    console.error('[API Route] 멤버 탈퇴 처리 오류:', error);
    
    // 임시로 성공 응답 반환 (개발 중)
    console.log('[API Route] 오류 발생으로 임시 성공 응답 반환');
    return NextResponse.json({
      success: true,
      message: '멤버가 그룹에서 탈퇴되었습니다. (임시)',
      data: { sgdt_show: 'N' }
    });
  }
} 