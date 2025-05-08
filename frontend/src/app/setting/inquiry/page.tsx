'use client';
import Header from '@/components/Header';
import React, { useState } from 'react';

function validateEmail(email: string) {
  return /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email);
}

export default function InquiryPage() {
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSend = () => {
    if (!validateEmail(email)) {
      setError('이메일 형식이 올바르지 않습니다.');
      return;
    }
    setError('');
    const subject = encodeURIComponent('[SMAP 문의] 1:1 문의');
    const body = encodeURIComponent(`문의 내용:\n${content}\n\n답변받을 이메일: ${email}`);
    window.location.href = `mailto:support@smap.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="bg-white min-h-screen pb-36 flex flex-col">
      <Header title="1:1 문의" />
      <div className="px-5 flex-1">
        <div className="h-6" />
        <div className="mb-4">
          <div className="text-xl font-extrabold leading-snug mb-6 mt-5">궁금한 점이나 불편한 점을 남겨주시면<br />운영팀이 빠르게 답변드릴게요.</div>
        </div>
        <div className="mb-2 font-semibold text-gray-700">문의 내용</div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="문의하실 내용을 입력해 주세요."
          rows={6}
          className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 resize-none"
        />
        <div className="mb-2 font-semibold text-gray-700">답변받을 이메일</div>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일 주소를 입력해 주세요."
          className="w-full bg-gray-100 rounded-2xl px-4 py-4 text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
        />
        {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      </div>
      <div className="fixed left-0 right-0 bottom-0 px-4 pb-4 bg-white shadow-[0_-2px_16px_0_rgba(0,0,0,0.04)] z-10">
        <button
          className="w-full mb-20 py-4 rounded-2xl bg-indigo-600 text-white text-lg font-normal shadow-md active:bg-indigo-700 transition"
          disabled={!content.trim() || !validateEmail(email)}
          onClick={handleSend}
        >
          문의하기
        </button>
      </div>
    </div>
  );
} 