import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  
  console.log('[AUTH CATCH-ALL] GET 요청 수신:', { path, url: request.url });
  
  return NextResponse.json({
    success: true,
    message: 'Auth catch-all API is working',
    path: path,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent') || 'unknown'
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  
  console.log('[AUTH CATCH-ALL] POST 요청 수신:', { path, url: request.url });
  
  try {
    const body = await request.json();
    console.log('[AUTH CATCH-ALL] 요청 본문:', body);
    
    return NextResponse.json({
      success: true,
      message: 'Auth catch-all API POST is working',
      path: path,
      timestamp: new Date().toISOString(),
      receivedData: body
    });
  } catch (error) {
    console.error('[AUTH CATCH-ALL] POST 요청 처리 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Invalid request body',
      path: path,
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  
  console.log('[AUTH CATCH-ALL] PUT 요청 수신:', { path, url: request.url });
  
  return NextResponse.json({
    success: true,
    message: 'Auth catch-all API PUT is working',
    path: path,
    timestamp: new Date().toISOString()
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  
  console.log('[AUTH CATCH-ALL] DELETE 요청 수신:', { path, url: request.url });
  
  return NextResponse.json({
    success: true,
    message: 'Auth catch-all API DELETE is working',
    path: path,
    timestamp: new Date().toISOString()
  });
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  
  console.log('[AUTH CATCH-ALL] OPTIONS 요청 수신:', { path, url: request.url });
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 