import { NextRequest, NextResponse } from 'next/server';
import { extractAuthToken } from '@/lib/auth';
import resolveBackendBaseUrl from '../../_utils/backend';

async function resolveTargetUrl(request: NextRequest, context: any, method: string): Promise<{ url?: string; errorResponse?: NextResponse }> {
  const params = await context.params;
  const { slug } = params;
  const path = Array.isArray(slug) ? slug.join('/') : slug || '';
  const backendBase = resolveBackendBaseUrl();
  const baseUrl = `${backendBase}/api/v1/push-logs/${path}`;

  if ((method === 'POST' || method === 'PATCH') && (path === 'read-all' || path === 'delete-all')) {
    const url = new URL(request.url);
    const mt_idx = url.searchParams.get('mt_idx');
    if (!mt_idx) {
      return { errorResponse: NextResponse.json({ error: 'mt_idx is required' }, { status: 400 }) };
    }
    return { url: `${baseUrl}?mt_idx=${encodeURIComponent(mt_idx)}` };
  }

  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  return { url: queryString ? `${baseUrl}?${queryString}` : baseUrl };
}

async function proxyPushLogs(request: NextRequest, context: any, method: string) {
  const token = extractAuthToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증 토큰이 필요합니다.' }, { status: 401 });
  }

  try {
    const { url: targetUrl, errorResponse } = await resolveTargetUrl(request, context, method);
    if (errorResponse || !targetUrl) {
      return errorResponse!;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Next.js API Proxy',
    };

    let bodyText: string | undefined;
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
      const raw = await request.text();
      if (raw) {
        bodyText = raw;
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      ...(bodyText !== undefined ? { body: bodyText } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: '푸시 로그 요청에 실패했습니다.', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error(`[API PROXY /push-logs] ${method} 오류:`, error);
    return NextResponse.json(
      { error: '푸시 로그 처리 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, context: any) {
  return proxyPushLogs(request, context, 'GET');
}

export async function POST(request: NextRequest, context: any) {
  return proxyPushLogs(request, context, 'POST');
}

export async function DELETE(request: NextRequest, context: any) {
  return proxyPushLogs(request, context, 'DELETE');
}

export async function PATCH(request: NextRequest, context: any) {
  return proxyPushLogs(request, context, 'PATCH');
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
