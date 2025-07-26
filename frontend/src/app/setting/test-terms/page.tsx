"use client";

// 🚨🚨🚨 즉시 실행 - 캐시 무력화 및 iOS WebView 환경 확인
(function() {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  console.log(`🚨🚨🚨🚨🚨 [TEST-TERMS-${uniqueId}] 파일 즉시 실행됨!!!`, {
    uniqueId,
    timestamp,
    buildTime: '2025-01-24T10:30:00Z', // 빌드 타임 표시
    userAgent: navigator.userAgent,
    isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
    isWebKit: /WebKit/i.test(navigator.userAgent),
    location: window.location.href,
    protocol: window.location.protocol,
    host: window.location.host,
    pathname: window.location.pathname
  });
  
  // 즉시 alert로도 확인
  if (window.location.pathname.includes('test-terms')) {
    alert(`🚨 TEST-TERMS 로드됨! ID: ${uniqueId.substr(-6)}`);
  }
  
  // iOS WebView 환경에서 알림
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent) || /WebKit/i.test(navigator.userAgent)) {
    console.log(`🚨🚨🚨 [TEST-TERMS-${uniqueId}] iOS/WebKit 환경 감지됨!`);
  }
  
  // 글로벌 함수로 상태 확인 가능하게
  (window as any).SMAP_DEBUG_TEST_TERMS = () => {
    console.log(`🚨🚨🚨 [TEST-TERMS-${uniqueId}] 글로벌 디버그 호출됨`, {
      timestamp: new Date().toISOString(),
      uniqueId,
      location: window.location.href
    });
    alert(`TEST-TERMS 디버그: ${uniqueId.substr(-6)} - ${timestamp}`);
  };
})();

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiFileText, FiShield, FiMapPin, FiUsers, FiGlobe } from 'react-icons/fi';
import { useAuth } from '@/contexts/AuthContext';

// 🚨🚨🚨 파일 로드 확인
console.log('🚨🚨🚨 [TEST-TERMS] 파일 로드됨!!!', new Date().toISOString());

// 약관 데이터
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
  },
  {
    id: 'third_party',
    dbField: 'mt_agree4',
    title: '개인정보 제3자 제공 동의',
    description: '개인정보 제3자 제공에 관한 동의사항입니다.',
    icon: FiUsers,
    isRequired: false,
    isConsented: false
  },
  {
    id: 'marketing',
    dbField: 'mt_agree5',
    title: '마케팅 정보 수집 및 이용 동의',
    description: '마케팅 목적의 개인정보 수집 및 이용에 관한 동의사항입니다.',
    icon: FiGlobe,
    isRequired: false,
    isConsented: false
  }
];

export default function TestTermsPage() {
  console.log('🚨🚨🚨 [TEST-TERMS] 컴포넌트 시작!!!');
  
  const router = useRouter();
  const { user } = useAuth();
  const [terms, setTerms] = useState(TERMS_DATA);
  const [isLoadingConsents, setIsLoadingConsents] = useState(true);

  console.log('🚨🚨🚨 [TEST-TERMS] user 상태:', user);

  // 글로벌 디버그 함수 등록
  useEffect(() => {
    (window as any).SMAP_TEST_TERMS_DEBUG = () => {
      console.log('🚨🚨🚨 [TEST-TERMS] 글로벌 디버그 함수 호출됨!', {
        user: user,
        terms: terms,
        isLoadingConsents: isLoadingConsents,
        timestamp: new Date().toISOString()
      });
      alert(`TEST-TERMS 디버그: user=${user?.mt_idx}, loading=${isLoadingConsents}`);
    };
    
    console.log('🚨🚨🚨 [TEST-TERMS] 글로벌 함수 등록 완료: window.SMAP_TEST_TERMS_DEBUG()');
  }, [user, terms, isLoadingConsents]);

  useEffect(() => {
    console.log('🚨🚨🚨 [TEST-TERMS] useEffect 실행!!!');
    
    if (user?.mt_idx) {
      console.log('🚨🚨🚨 [TEST-TERMS] 사용자 정보 있음, API 호출 시작:', user.mt_idx);
      loadUserConsents();
    } else {
      console.log('🚨🚨🚨 [TEST-TERMS] 사용자 정보 없음!!!');
      setIsLoadingConsents(false);
    }
  }, [user]);

  // 실제 동의 정보 조회 함수
  const loadUserConsents = async () => {
    console.log('🚨🚨🚨 [TEST-TERMS] loadUserConsents 시작');
    
    if (!user?.mt_idx) {
      console.error('🚨🚨🚨 [TEST-TERMS] 사용자 정보가 없습니다.');
      setIsLoadingConsents(false);
      return;
    }

    try {
      const token = localStorage.getItem('auth-token');
      console.log('🚨🚨🚨 [TEST-TERMS] 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
      
      if (!token) {
        console.error('🚨🚨🚨 [TEST-TERMS] 토큰이 없습니다.');
        setIsLoadingConsents(false);
        return;
      }

      const apiUrl = `/api/v1/members/consent/${user.mt_idx}`;
      console.log('🚨🚨🚨 [TEST-TERMS] API 호출 시작:', apiUrl);

      // iOS WebView 환경을 위한 fetch 옵션
      const fetchOptions = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'same-origin' as RequestCredentials,
        // iOS WebView에서 타임아웃 설정
        signal: AbortSignal.timeout(30000)
      };

      console.log('🚨🚨🚨 [TEST-TERMS] Fetch 옵션:', fetchOptions);

      const response = await fetch(apiUrl, fetchOptions);

      console.log('🚨🚨🚨 [TEST-TERMS] API 응답 상태:', response.status);
      
      if (!response.ok) {
        console.error('🚨🚨🚨 [TEST-TERMS] API 응답 오류:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🚨🚨🚨 [TEST-TERMS] 동의 정보 조회 응답:', result);

      if (result.success && result.data) {
        const userConsents = result.data;
        console.log('🚨🚨🚨 [TEST-TERMS] 동의 정보 데이터:', userConsents);
        
        setTerms(prev => prev.map(term => ({
          ...term,
          isConsented: userConsents[term.dbField as keyof typeof userConsents] === 'Y'
        })));
        
        console.log('🚨🚨🚨 [TEST-TERMS] 동의 정보 로드 성공');
      } else {
        console.warn('🚨🚨🚨 [TEST-TERMS] 동의 정보 조회 실패, 기본값 설정:', result.message);
        setTerms(prev => prev.map(term => ({
          ...term,
          isConsented: false
        })));
      }
    } catch (error) {
      console.error('🚨🚨🚨 [TEST-TERMS] 동의 정보 로드 실패:', error);
      
      // 폴백 로직: 사용자 컨텍스트에서 가져오기
      if (user) {
        console.log('🚨🚨🚨 [TEST-TERMS] 폴백: 사용자 컨텍스트에서 동의 정보 가져오기');
        const userConsents = {
          mt_agree1: user.mt_agree1 || 'N',
          mt_agree2: user.mt_agree2 || 'N',
          mt_agree3: user.mt_agree3 || 'N',
          mt_agree4: user.mt_agree4 || 'N',
          mt_agree5: user.mt_agree5 || 'N'
        };
        
        console.log('🚨🚨🚨 [TEST-TERMS] 폴백 동의 정보:', userConsents);
        
        setTerms(prev => prev.map(term => ({
          ...term,
          isConsented: userConsents[term.dbField as keyof typeof userConsents] === 'Y'
        })));
      }
    } finally {
      console.log('🚨🚨🚨 [TEST-TERMS] 동의 정보 로딩 완료');
      setIsLoadingConsents(false);
    }
  };

  // 동의 상태 변경 함수
  const handleConsentToggle = async (termId: string) => {
    console.log('🚨🚨🚨 [TEST-TERMS] 동의 상태 변경 시작:', termId);
    
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const term = terms.find(t => t.id === termId);
    if (!term) return;

    if (term.isRequired) {
      alert('필수 약관은 변경할 수 없습니다.');
      return;
    }

    // 즉시 UI 업데이트 (낙관적 업데이트)
    setTerms(prevTerms => 
      prevTerms.map(t => 
        t.id === termId 
          ? { ...t, isConsented: !t.isConsented }
          : t
      )
    );

    try {
      const newConsentValue = term.isConsented ? 'N' : 'Y';
      const token = localStorage.getItem('auth-token');
      
      if (!token) {
        throw new Error('인증 토큰이 없습니다.');
      }

      console.log('🚨🚨🚨 [TEST-TERMS] 동의 상태 변경 API 호출:', { field: term.dbField, value: newConsentValue });
      
      const response = await fetch('/api/v1/members/consent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field: term.dbField,
          value: newConsentValue
        }),
      });

      console.log('🚨🚨🚨 [TEST-TERMS] 동의 상태 변경 API 응답 상태:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🚨🚨🚨 [TEST-TERMS] 개별 동의 상태 변경 응답:', result);

      if (!result.success) {
        throw new Error(result.message || '동의 상태 변경 실패');
      }

      console.log('🚨🚨🚨 [TEST-TERMS] 개별 동의 상태 변경 성공');
      alert('동의 상태가 변경되었습니다!');
    } catch (error) {
      console.error('🚨🚨🚨 [TEST-TERMS] 동의 상태 변경 실패:', error);
      
      // API 실패 시 원래 상태로 되돌리기
      setTerms(prevTerms => 
        prevTerms.map(t => 
          t.id === termId 
            ? { ...t, isConsented: !t.isConsented }
            : t
        )
      );
      
      alert('동의 상태 변경에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleBack = () => {
    console.log('🚨🚨🚨 [TEST-TERMS] 뒤로가기 클릭!!!');
    router.push('/setting');
  };

  // 동의 통계
  const consentStats = {
    total: terms.length,
    consented: terms.filter(term => term.isConsented).length,
    required: terms.filter(term => term.isRequired).length,
    requiredConsented: terms.filter(term => term.isRequired && term.isConsented).length
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
        <h1 style={{ margin: 0, fontSize: '24px' }}>약관 및 동의 (테스트)</h1>
      </div>

      {/* 동의 현황 카드 */}
      <div style={{ 
        backgroundColor: '#EBB305', 
        color: 'white', 
        padding: '20px', 
        borderRadius: '16px',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: '0 0 10px 0' }}>동의 현황</h2>
        <p style={{ margin: '0 0 10px 0' }}>전체 {consentStats.consented}/{consentStats.total} 동의 완료</p>
        <p style={{ margin: 0, fontSize: '14px' }}>
          필수: {consentStats.requiredConsented}/{consentStats.required} | 
          선택: {consentStats.consented - consentStats.requiredConsented}/{consentStats.total - consentStats.required}
        </p>
      </div>

      {/* 로딩 상태 */}
      {isLoadingConsents ? (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'yellow', borderRadius: '12px' }}>
          <p>🚨 동의 정보를 불러오는 중...</p>
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
                marginBottom: '12px',
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
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                  {term.isRequired && (
                    <span style={{ 
                      display: 'inline-block',
                      marginRight: '8px',
                      padding: '2px 8px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      fontSize: '12px',
                      borderRadius: '12px'
                    }}>
                      필수
                    </span>
                  )}
                  <span style={{ 
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: term.isConsented ? '#22c55e' : '#e5e7eb',
                    color: term.isConsented ? 'white' : '#6b7280',
                    fontSize: '12px',
                    borderRadius: '12px'
                  }}>
                    {term.isConsented ? '동의함' : '동의안함'}
                  </span>
                </div>
              </div>
              {!term.isRequired && (
                <button
                  onClick={() => handleConsentToggle(term.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: term.isConsented ? '#ef4444' : '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    marginLeft: '10px'
                  }}
                >
                  {term.isConsented ? '해제' : '동의'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 