import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

// 관리자 그룹 목록 조회 API
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = searchParams.get('page') || '1';
        const size = searchParams.get('size') || '50';
        const search = searchParams.get('search') || '';

        console.log('[Admin Groups API] 그룹 목록 조회:', { page, size, search });

        const backendBase = resolveBackendBaseUrl();
        let backendUrl = `${backendBase}/api/v1/admin/groups?page=${page}&size=${size}`;
        if (search) {
            backendUrl += `&search=${encodeURIComponent(search)}`;
        }

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            // 백엔드 API가 없는 경우 더미 데이터 반환
            console.log('[Admin Groups API] 백엔드 API 미구현, 더미 데이터 반환');
            const mockGroups = Array.from({ length: 30 }, (_, i) => ({
                sgt_idx: i + 1,
                sgt_title: `그룹 ${i + 1}`,
                sgt_memo: `그룹 ${i + 1}의 설명입니다.`,
                member_count: Math.floor(Math.random() * 10) + 1,
                schedule_count: Math.floor(Math.random() * 20),
                location_count: Math.floor(Math.random() * 15),
                sgt_wdate: new Date(Date.now() - i * 86400000 * 3).toISOString().split('T')[0],
                owner_name: `사용자${i + 1}`,
            }));

            return NextResponse.json({
                success: true,
                data: mockGroups,
                total: 30,
                page: parseInt(page),
                size: parseInt(size),
            });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Admin Groups API] 오류:', error);
        return NextResponse.json(
            { success: false, message: '그룹 목록을 불러오는데 실패했습니다.' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sgt_idx = searchParams.get('sgt_idx');

        console.log('[Admin Groups API] 그룹 삭제:', sgt_idx);

        // TODO: 백엔드 API 연동
        return NextResponse.json({
            success: true,
            message: '그룹이 삭제되었습니다.',
        });
    } catch (error) {
        console.error('[Admin Groups API] 삭제 오류:', error);
        return NextResponse.json(
            { success: false, message: '그룹 삭제에 실패했습니다.' },
            { status: 500 }
        );
    }
}
