import React from 'react';

interface AnimatedHeaderProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'simple' | 'enhanced';
  delay?: number;
  duration?: number;
}

// iOS WebView 완벽 호환 고정 헤더 (애니메이션 제거)
const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  children,
  className = 'glass-effect header-fixed',
  style = {},
  variant = 'simple',
  delay,
  duration
}) => {
  // 안정적인 고정 헤더 스타일
  const fixedHeaderStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    height: '64px',
    minHeight: '64px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
    // iOS WebView 최적화
    transform: 'translateZ(0)',
    WebkitTransform: 'translateZ(0)',
    willChange: 'auto', // willChange를 auto로 변경하여 성능 최적화
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
    // 항상 표시되도록 강제 설정
    opacity: 1,
    visibility: 'visible',
    display: 'flex',
    alignItems: 'center', // 수직 중앙 정렬
    // 모든 여백 제거
    padding: 0,
    margin: 0,
    paddingTop: 0,
    marginTop: 0,
    ...style
  };

  return (
    <header
      className={className}
      style={fixedHeaderStyle}
    >
      {children}
    </header>
  );
};

export default AnimatedHeader; 