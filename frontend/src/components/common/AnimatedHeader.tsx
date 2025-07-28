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

// iOS WebView 완벽 호환 고정 헤더 (애니메이션 포함)
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
    // 애니메이션을 위해 opacity와 visibility 제거
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

  // 애니메이션 변형
  const animationVariants = {
    simple: {
      initial: duration === 0 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 },
      animate: { opacity: 1, x: 0 },
      exit: duration === 0 ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 },
      transition: { duration: duration === 0 ? 0 : 0.5, delay }
    },
    enhanced: {
      initial: duration === 0 ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -30, scale: 0.95 },
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: duration === 0 ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -30, scale: 0.95 },
      transition: { duration: duration === 0 ? 0 : duration, delay }
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