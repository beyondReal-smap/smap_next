import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'v1 API 구조가 정상적으로 작동합니다.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
} 