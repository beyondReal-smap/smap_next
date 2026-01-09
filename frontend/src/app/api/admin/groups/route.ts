import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../_utils/backend';

// 관리자 그룹 목록 조회 API - 백엔드 /api/v1/groups/ 사용
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '10000');
        const search = searchParams.get('search') || '';
        const skip = (page - 1) * size;
        const showHidden = searchParams.get('show_hidden') === 'true';

        console.log('[Admin Groups API] 그룹 목록 조회:', { page, size, search, skip, showHidden });

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/groups/?skip=${skip}&limit=${size}&show_hidden=${showHidden}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('[Admin Groups API] 백엔드 에러:', response.status);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Admin Groups API] 백엔드 응답 성공, 그룹 수:', Array.isArray(data) ? data.length : 'N/A');

        // 검색어가 있으면 필터링
        let groups = Array.isArray(data) ? data : [];
        if (search) {
            const searchLower = search.toLowerCase();
            groups = groups.filter((g: any) =>
                (g.sgt_title && g.sgt_title.toLowerCase().includes(searchLower)) ||
                (g.sgt_memo && g.sgt_memo.toLowerCase().includes(searchLower)) ||
                (g.sgt_code && g.sgt_code.toLowerCase().includes(searchLower))
            );
        }

        return NextResponse.json({
            success: true,
            data: groups,
            total: groups.length,
            page,
            size,
        });
    } catch (error) {
        console.error('[Admin Groups API] 오류:', error);
        return NextResponse.json(
            { success: false, message: '그룹 목록을 불러오는데 실패했습니다.', error: String(error) },
            { status: 500 }
        );
    }
}

// 그룹 숨김 처리 (소프트 삭제) - 백엔드 /api/v1/groups/{group_id} PUT으로 sgt_show='N'
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { sgt_idx, ...updateData } = body;

        if (!sgt_idx) {
            return NextResponse.json({ success: false, message: '그룹 ID가 필요합니다.' }, { status: 400 });
        }

        console.log('[Admin Groups API] 그룹 정보 수정:', sgt_idx, updateData);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/groups/${sgt_idx}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin Groups API] 수정 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            message: '그룹 정보가 수정되었습니다.',
            data,
        });
    } catch (error) {
        console.error('[Admin Groups API] 수정 오류:', error);
        return NextResponse.json(
            { success: false, message: '그룹 정보 수정에 실패했습니다.' },
            { status: 500 }
        );
    }
}

// 그룹 삭제 (숨김 처리)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sgt_idx = searchParams.get('sgt_idx');

        if (!sgt_idx) {
            return NextResponse.json({ success: false, message: '그룹 ID가 필요합니다.' }, { status: 400 });
        }

        console.log('[Admin Groups API] 그룹 삭제 (숨김처리):', sgt_idx);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/groups/${sgt_idx}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        // sgt_show를 'N'으로 설정하여 소프트 삭제
        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sgt_show: 'N' }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin Groups API] 삭제 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

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
