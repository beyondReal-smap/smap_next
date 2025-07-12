import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedHeaderProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'simple' | 'enhanced';
  delay?: number;
  duration?: number;
}

// iOS WebView 완벽 호환 고정 헤더 (애니메이션 복원)
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
    willChange: 'auto', // willChange를 auto로 변경하여 성능 최적화
    WebkitBackfaceVisibility: 'hidden',
    backfaceVisibility: 'hidden',
    // 항상 표시되도록 강제 설정
    opacity: 1,
    visibility: 'visible',
    display: 'flex',
    alignItems: 'center', // 수직 중앙 정렬
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

  // 애니메이션 variants - 부드러운 페이드인 효과
  const headerVariants = {
    initial: { opacity: 0, y: -8 }, // 더 작은 y 값으로 자연스러운 움직임
    animate: { 
      opacity: 1, 
      y: 0
    }
  };

  return (
    <motion.header
      className={className}
      style={fixedHeaderStyle}
      variants={headerVariants}
      initial="initial"
      animate="animate"
      transition={{
        duration: duration * 0.8, // 더 빠른 애니메이션으로 자연스러움 증가
        delay,
        ease: [0.25, 0.1, 0.25, 1] // 커스텀 베지어 곡선으로 더 부드러운 애니메이션
      }}
    >
      {children}
    </motion.header>
  );
};

export default AnimatedHeader; 