import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[AUTH API] GET 요청 수신:', request.url);
  
  return NextResponse.json({
    success: true,
    message: 'Auth API is working',
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent') || 'unknown'
  });
}

export async function POST(request: NextRequest) {
  console.log('[AUTH API] POST 요청 수신:', request.url);
  
  try {
    const body = await request.json();
    console.log('[AUTH API] 요청 본문:', body);
    
    return NextResponse.json({
      success: true,
      message: 'Auth API POST is working',
      timestamp: new Date().toISOString(),
      receivedData: body
    });
  } catch (error) {
    console.error('[AUTH API] POST 요청 처리 오류:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Invalid request body',
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
}

export async function OPTIONS(request: NextRequest) {
  console.log('[AUTH API] OPTIONS 요청 수신:', request.url);
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 