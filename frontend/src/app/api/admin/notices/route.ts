import { NextRequest, NextResponse } from 'next/server';
import resolveBackendBaseUrl from '../../../_utils/backend';

// 관리자 공지사항 목록 조회 API - 백엔드 /api/v1/notices/ 사용
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const size = parseInt(searchParams.get('size') || '20');
        const showOnly = searchParams.get('show_only') !== 'false'; // 기본값 true

        console.log('[Admin Notices API] 공지사항 목록 조회:', { page, size, showOnly });

        const backendBase = resolveBackendBaseUrl();
        // 관리자용이므로 show_only=false로 비공개 공지도 포함 가능
        const backendUrl = `${backendBase}/api/v1/notices/?page=${page}&size=${size}&show_only=false`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('[Admin Notices API] 백엔드 에러:', response.status);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Admin Notices API] 백엔드 응답 성공');

        return NextResponse.json({
            success: true,
            data: data.data || data,
            total: data.total || (data.data ? data.data.length : 0),
            page: data.page || page,
            size: data.size || size,
        });
    } catch (error) {
        console.error('[Admin Notices API] 오류:', error);
        return NextResponse.json(
            { success: false, message: '공지사항을 불러오는데 실패했습니다.', error: String(error) },
            { status: 500 }
        );
    }
}

// 공지사항 작성 - 백엔드 /api/v1/notices/ POST
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[Admin Notices API] 공지사항 작성:', body);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/notices/`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nt_title: body.nt_title || body.title,
                nt_content: body.nt_content || body.content,
                nt_show: body.nt_show || 'Y',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin Notices API] 작성 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            message: '공지사항이 등록되었습니다.',
            data,
        });
    } catch (error) {
        console.error('[Admin Notices API] 작성 오류:', error);
        return NextResponse.json(
            { success: false, message: '공지사항 등록에 실패했습니다.' },
            { status: 500 }
        );
    }
}

// 공지사항 수정 - 백엔드 /api/v1/notices/{notice_id} PUT
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { nt_idx, ...updateData } = body;

        if (!nt_idx) {
            return NextResponse.json({ success: false, message: '공지사항 ID가 필요합니다.' }, { status: 400 });
        }

        console.log('[Admin Notices API] 공지사항 수정:', nt_idx, updateData);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/notices/${nt_idx}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nt_title: updateData.nt_title || updateData.title,
                nt_content: updateData.nt_content || updateData.content,
                nt_show: updateData.nt_show,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin Notices API] 수정 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            message: '공지사항이 수정되었습니다.',
            data,
        });
    } catch (error) {
        console.error('[Admin Notices API] 수정 오류:', error);
        return NextResponse.json(
            { success: false, message: '공지사항 수정에 실패했습니다.' },
            { status: 500 }
        );
    }
}

// 공지사항 삭제 - 백엔드 /api/v1/notices/{notice_id} DELETE
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const nt_idx = searchParams.get('nt_idx');

        if (!nt_idx) {
            return NextResponse.json({ success: false, message: '공지사항 ID가 필요합니다.' }, { status: 400 });
        }

        console.log('[Admin Notices API] 공지사항 삭제:', nt_idx);

        const backendBase = resolveBackendBaseUrl();
        const backendUrl = `${backendBase}/api/v1/notices/${nt_idx}`;

        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Admin Notices API] 삭제 실패:', response.status, errorText);
            throw new Error(`Backend API error: ${response.status}`);
        }

        return NextResponse.json({
            success: true,
            message: '공지사항이 삭제되었습니다.',
        });
    } catch (error) {
        console.error('[Admin Notices API] 삭제 오류:', error);
        return NextResponse.json(
            { success: false, message: '공지사항 삭제에 실패했습니다.' },
            { status: 500 }
        );
    }
}
