'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// 멤버 타입 정의
interface Member {
  mt_idx: string;
  mt_name: string;
  mt_file1: string;
  mt_hp: string;
  mt_email: string;
  mt_level: number;
  mt_regdate: string;
  mt_status: string;
  mt_lat: string;
  mt_long: string;
  // ... 기타 필요한 필드
}

// 타입 체크 우회를 위해 any 사용
export default function MemberDetailPage({ params }: any) {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 멤버 상세 정보 조회
  useEffect(() => {
    const fetchMemberDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/members/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('멤버를 찾을 수 없습니다.');
          }
          throw new Error(`멤버 조회 실패: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('멤버 상세 데이터:', data);
        setMember(data);
      } catch (err) {
        console.error('멤버 상세 조회 오류:', err);
        setError(err instanceof Error ? err.message : '멤버 데이터를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchMemberDetail();
  }, [params.id]);

  const handleGoBack = () => {
    router.back();
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
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">오류 발생:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <button
          onClick={handleGoBack}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="text-gray-600">멤버 정보가 없습니다.</div>
        <button
          onClick={handleGoBack}
          className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={handleGoBack}
        className="mb-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        목록으로 돌아가기
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/3 p-4 bg-indigo-50">
            <div className="w-full h-64 md:h-auto relative bg-gray-200 flex items-center justify-center overflow-hidden">
              {member.mt_file1 ? (
                <img
                  src={member.mt_file1}
                  alt={member.mt_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 text-9xl">👤</div>
              )}
            </div>
          </div>
          <div className="md:w-2/3 p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{member.mt_name}</h1>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  member.mt_level === 3 ? 'bg-indigo-100 text-indigo-800' :
                  member.mt_level === 2 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  레벨 {member.mt_level}
                </span>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${
                member.mt_status === 'Y' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {member.mt_status === 'Y' ? '활성' : '비활성'}
              </span>
            </div>

            <div className="mt-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h2 className="text-sm text-gray-500">연락처</h2>
                  <p className="text-lg text-gray-900">{member.mt_hp}</p>
                </div>
                <div>
                  <h2 className="text-sm text-gray-500">이메일</h2>
                  <p className="text-lg text-gray-900">{member.mt_email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h2 className="text-sm text-gray-500">위치 정보</h2>
                  <p className="text-lg text-gray-900">
                    {member.mt_lat && member.mt_long ?
                      `${member.mt_lat}, ${member.mt_long}` :
                      '위치 정보 없음'
                    }
                  </p>
                </div>
                <div>
                  <h2 className="text-sm text-gray-500">가입일</h2>
                  <p className="text-lg text-gray-900">
                    {new Date(member.mt_regdate).toLocaleDateString()} 
                    {new Date(member.mt_regdate).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex space-x-4">
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
                수정하기
              </button>
              <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                그룹 관리
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">위치 정보</h2>
        {member.mt_lat && member.mt_long ? (
          <div className="w-full h-48 bg-gray-200 rounded-lg">
            <p className="text-gray-500">지도가 여기에 표시됩니다. (mt_lat: {member.mt_lat}, mt_long: {member.mt_long})</p>
          </div>
        ) : (
          <p className="text-gray-500">위치 정보가 없습니다.</p>
        )}
      </div>
    </div>
  );
} 