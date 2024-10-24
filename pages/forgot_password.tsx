import { useState } from 'react';
import { useRouter } from 'next/router';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      if (res.ok) {
        setMessage('비밀번호 재설정 링크가 이메일로 전송되었습니다.');
      } else {
        setMessage('이메일 전송에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      setMessage('오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">비밀번호 찾기</h2>
        {message && (
          <div className="mb-4 p-4 bg-blue-100 text-blue-700 rounded">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          >
            비밀번호 재설정 링크 받기
          </button>
        </form>
      </div>
    </div>
  );
}