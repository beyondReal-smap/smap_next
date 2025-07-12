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
  delay = 0,
  duration = 0.6
}) => {
  // iOS 감지
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
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
    willChange: 'auto',
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
    // 항상 표시되도록 강제 설정
    opacity: 1,
    visibility: 'visible',
    display: 'flex',
    alignItems: 'center',
    // 모든 여백 완전 제거
    padding: '0px !important',
    margin: '0px !important',
    paddingTop: '0px !important',
    marginTop: '0px !important',
    // iOS 전용 상단 고정
    ...(isIOS && {
      top: '0px !important',
      paddingTop: '0px !important',
      marginTop: '0px !important'
    }),
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