import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth-config'

const handler = NextAuth(authOptions)

// 동적 라우트 설정 (빌드 시 정적 생성 방지)
export const dynamic = 'force-dynamic'

export { handler as GET, handler as POST } 