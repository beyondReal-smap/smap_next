import { NextResponse } from 'next/server'
import { track } from '@vercel/analytics/server'
import { reportValue } from 'flags'

export async function GET() {
  // 서버에서 플래그 값 보고 (런타임 로그와 Analytics에서 사용)
  reportValue('summer-sale', false)

  // 서버 측 커스텀 이벤트에 해당 플래그를 첨부하여 추적
  track('FF Server Test', {}, { flags: ['summer-sale'] })

  return NextResponse.json({ ok: true })
}


