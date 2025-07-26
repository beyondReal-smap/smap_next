"use client";
import React, { useState, useEffect } from 'react';

// 🚨🚨🚨 테스트 파일 로드 확인
console.log('🚨🚨🚨🚨🚨 [TEST-TERMS] 새 파일이 로드되었습니다!!!', new Date().toISOString());
alert('🚨 TEST-TERMS 새 파일이 로드되었습니다!');

export default function TestTermsPage() {
  console.log('🚨🚨🚨🚨🚨 [TEST-TERMS] 컴포넌트 실행됨!!!');
  
  useEffect(() => {
    console.log('🚨🚨🚨🚨🚨 [TEST-TERMS] useEffect 실행됨!!!');
  }, []);

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'lime', 
      minHeight: '100vh',
      textAlign: 'center'
    }}>
      <h1 style={{ color: 'red', fontSize: '32px' }}>🚨 TEST TERMS 페이지 🚨</h1>
      <p style={{ fontSize: '20px' }}>이 페이지가 보인다면 새 파일이 제대로 작동합니다!</p>
      <p>현재 시간: {new Date().toISOString()}</p>
      <button 
        onClick={() => {
          console.log('🚨🚨🚨 테스트 버튼 클릭됨!');
          alert('테스트 버튼이 클릭되었습니다!');
        }}
        style={{
          padding: '15px 30px',
          fontSize: '18px',
          backgroundColor: 'red',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        🚨 테스트 버튼 🚨
      </button>
    </div>
  );
} 