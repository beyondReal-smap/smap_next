'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../components/common/LoadingSpinner';
import memberService, { Member } from '@/services/memberService';

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 멤버 목록 조회
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await memberService.getAllMembers();
        
        console.log('멤버 데이터 조회 결과:', data.length);
        setMembers(data);
      } catch (err) {
        console.error('멤버 조회 오류:', err);
        setError(err instanceof Error ? err.message : '멤버 데이터를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  // 멤버 상세 페이지 이동
  const handleMemberClick = (id: number) => {
    router.push(`/members/${id}`);
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-screen">
        <LoadingSpinner message="멤버 정보를 불러오는 중입니다..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">오류 발생:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">멤버 목록</h1>
        <p className="text-gray-600">전체 멤버 {members.length}명</p>
      </header>

      {members.length === 0 ? (
        <div className="text-center text-gray-500 py-10">등록된 멤버가 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {members.map((member) => (
            <div
              key={member.mt_idx}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleMemberClick(member.mt_idx)}
            >
              <div className="p-1 bg-indigo-50">
                <div className="w-full h-48 relative">
                  <div className="h-12 w-12 rounded-full bg-indigo-100 flex-shrink-0 overflow-hidden">
                    {member.mt_file1 ? (
                      <img
                        src={member.mt_file1}
                        alt={member.mt_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">{member.mt_name}</h2>
                <p className="text-gray-600 text-sm mb-2">{member.mt_hp}</p>
                <p className="text-gray-500 text-xs">{member.mt_email}</p>
                <div className="mt-3 flex justify-between items-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    member.mt_level === 3 ? 'bg-indigo-100 text-indigo-800' :
                    member.mt_level === 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    레벨 {member.mt_level}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(member.mt_wdate || member.mt_regdate || '').toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 