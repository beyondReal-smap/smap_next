import React from "react";

export default function AuthPage() {
  return (
    <main style={{ padding: 32, textAlign: "center" }}>
      <h1>인증 페이지</h1>
      <p>여기는 인증 관련 페이지입니다.<br/>Google 또는 Kakao 로그인을 진행하세요.</p>
      {/* 실제 로그인 버튼은 기존 컴포넌트와 연동 필요 */}
    </main>
  );
} 