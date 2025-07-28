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

// iOS WebView 완벽 호환 고정 헤더 (애니메이션 제거로 깜빡임 방지)
const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  children,
  className = 'glass-effect header-fixed',
  style = {},
  variant = 'simple',
  delay = 0,
  duration = 0
}) => {
  // iOS 감지
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // 안정적인 고정 헤더 스타일 - 통일된 62px 높이
  const fixedHeaderStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2147483647,
    height: '62px !important' as any,
    minHeight: '62px !important' as any,
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
    // 깜빡임 방지를 위해 즉시 표시
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

  // 애니메이션 비활성화로 깜빡임 방지
  const animationVariants = {
    simple: {
      initial: { opacity: 1, x: 0 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 1, x: 0 },
      transition: { duration: 0, delay: 0 }
    },
    enhanced: {
      initial: { opacity: 1, x: 0, scale: 1 },
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 1, x: 0, scale: 1 },
      transition: { duration: 0, delay: 0 }
    }
  };

  const currentVariant = animationVariants[variant];

  return (
    <motion.header
      className={className}
      style={fixedHeaderStyle}
      initial={currentVariant.initial}
      animate={currentVariant.animate}
      exit={currentVariant.exit}
      transition={currentVariant.transition}
    >
      {children}
    </motion.header>
  );
};

export default AnimatedHeader; 