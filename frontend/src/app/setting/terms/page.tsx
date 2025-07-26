"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiFileText, FiShield, FiMapPin, FiUsers, FiGlobe } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';

// 간단한 약관 데이터
const TERMS_DATA = [
  {
    id: 'service',
    dbField: 'mt_agree1',
    title: '서비스 이용약관',
    description: 'SMAP 서비스 이용에 관한 기본 약관입니다.',
    icon: FiFileText,
    isRequired: true,
    isConsented: false
  },
  {
    id: 'privacy',
    dbField: 'mt_agree2', 
    title: '개인정보 처리방침',
    description: '개인정보 수집, 이용, 보관에 관한 정책입니다.',
    icon: FiShield,
    isRequired: true,
    isConsented: false
  },
  {
    id: 'location',
    dbField: 'mt_agree3',
    title: '위치기반서비스 이용약관', 
    description: '위치 기반 서비스 이용에 관한 약관입니다.',
    icon: FiMapPin,
    isRequired: true,
    isConsented: false
  }
];

export default function TermsPage() {
  console.log('🚨 [TERMS] 컴포넌트 시작');
  
  const router = useRouter();
  const { user } = useAuth();
  const [terms, setTerms] = useState(TERMS_DATA);
  const [isLoadingConsents, setIsLoadingConsents] = useState(true);

  console.log('🚨 [TERMS] user 상태:', user);

  useEffect(() => {
    console.log('🚨 [TERMS] useEffect 실행');
    
    // 사용자 정보가 있으면 동의 정보 조회 시뮬레이션
    if (user?.mt_idx) {
      console.log('🚨 [TERMS] 사용자 정보 있음, API 호출 예정:', user.mt_idx);
      
      // 일단 기본값으로 설정
      setTimeout(() => {
        console.log('🚨 [TERMS] 로딩 완료');
        setIsLoadingConsents(false);
      }, 1000);
    } else {
      console.log('🚨 [TERMS] 사용자 정보 없음');
      setIsLoadingConsents(false);
    }
  }, [user]);

  const handleBack = () => {
    console.log('🚨 [TERMS] 뒤로가기 클릭');
    router.push('/setting');
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#f9f9f9' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
        <button 
          onClick={handleBack}
          style={{ 
            padding: '10px', 
            marginRight: '10px', 
            backgroundColor: '#EBB305', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ← 뒤로
        </button>
        <h1 style={{ margin: 0, fontSize: '24px' }}>약관 및 동의</h1>
      </div>

      {/* 로딩 상태 */}
      {isLoadingConsents ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>동의 정보를 불러오는 중...</p>
        </div>
      ) : (
        /* 약관 목록 */
        <div>
          {terms.map((term, index) => (
            <div 
              key={term.id}
              style={{
                backgroundColor: 'white',
                padding: '20px',
                marginBottom: '10px',
                borderRadius: '12px',
                border: '1px solid #e5e5e5',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <div style={{ marginRight: '15px', fontSize: '24px' }}>
                <term.icon />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{term.title}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{term.description}</p>
                {term.isRequired && (
                  <span style={{ 
                    display: 'inline-block',
                    marginTop: '5px',
                    padding: '2px 8px',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    fontSize: '12px',
                    borderRadius: '12px'
                  }}>
                    필수
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 