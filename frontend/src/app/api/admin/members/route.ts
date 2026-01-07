import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

// 관리자 회원 목록 조회 API - 백엔드 /api/v1/members/ 사용
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '100');
        const search = searchParams.get('search') || '';
        const skip = (page - 1) * size;

        console.log('[Admin Members API] 회원 목록 조회:', { page, size, search, skip });

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/members/?skip=${skip}&limit=${size}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('[Admin Members API] 백엔드 에러:', response.status);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Admin Members API] 백엔드 응답 성공, 회원 수:', Array.isArray(data) ? data.length : 'N/A');

        // 검색어가 있으면 필터링
        let members = Array.isArray(data) ? data : [];
        if (search) {
            const searchLower = search.toLowerCase();
            members = members.filter((m: any) =>
                (m.mt_name && m.mt_name.toLowerCase().includes(searchLower)) ||
                (m.mt_nickname && m.mt_nickname.toLowerCase().includes(searchLower)) ||
                (m.mt_email && m.mt_email.toLowerCase().includes(searchLower)) ||
                (m.mt_hp && m.mt_hp.includes(search))
            );
        }

        return NextResponse.json({
            success: true,
            data: members,
            total: members.length,
            page,
            size,
        });
    } catch (error) {
        console.error('[Admin Members API] 오류:', error);
        return NextResponse.json(
            { success: false, message: '회원 목록을 불러오는데 실패했습니다.', error: String(error) },
            { status: 500 }
        );
    }
}

// 회원 정보 수정 API - 백엔드 /api/v1/members/{member_id} PUT 사용
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { mt_idx, ...updateData } = body;

        if (!mt_idx) {
            return NextResponse.json({ success: false, message: '회원 ID가 필요합니다.' }, { status: 400 });
        }

        console.log('[Admin Members API] 회원 정보 수정:', mt_idx, updateData);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/members/${mt_idx}`;

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
            console.error('[Admin Members API] 수정 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            message: '회원 정보가 수정되었습니다.',
            data,
        });
    } catch (error) {
        console.error('[Admin Members API] 수정 오류:', error);
        return NextResponse.json(
            { success: false, message: '회원 정보 수정에 실패했습니다.' },
            { status: 500 }
        );
    }
}

// 회원 삭제 API - 백엔드 /api/v1/members/{member_id} DELETE 사용
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mt_idx = searchParams.get('mt_idx');

        if (!mt_idx) {
            return NextResponse.json({ success: false, message: '회원 ID가 필요합니다.' }, { status: 400 });
        }

        console.log('[Admin Members API] 회원 삭제:', mt_idx);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/members/${mt_idx}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin Members API] 삭제 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        return NextResponse.json({
            success: true,
            message: '회원이 삭제되었습니다.',
        });
    } catch (error) {
        console.error('[Admin Members API] 삭제 오류:', error);
        return NextResponse.json(
            { success: false, message: '회원 삭제에 실패했습니다.' },
            { status: 500 }
        );
    }
}
