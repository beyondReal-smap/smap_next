import LoginForm from '../components/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <LoginForm />
      <div className="max-w-md mx-auto mt-4 text-center">
        <Link href="/signup" className="text-blue-500 hover:underline">
          회원가입
        </Link>
        {' | '}
        <Link href="/forgot-password" className="text-blue-500 hover:underline">
          비밀번호 찾기
        </Link>
      </div>
    </div>
  );
}