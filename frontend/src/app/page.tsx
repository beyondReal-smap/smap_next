import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// 서버 컴포넌트: 초기 요청 단계에서 바로 리다이렉트 처리
export default function RootPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value

  if (token) {
    redirect('/home')
  }
  redirect('/signin')
}