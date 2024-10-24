import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // 메인 페이지 접속 시 로그인 페이지로 리다이렉트
    router.push('/login');
  }, []);
  
  return null;
}