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

// 통일된 헤더 애니메이션 설정
const headerAnimations = {
  simple: {
    initial: { y: -120, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: {
      delay: 0.1,
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
      y: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
      opacity: { duration: 0.4, delay: 0.2 }
    }
  },
  enhanced: {
    initial: { y: -150, opacity: 0, scale: 0.95 },
    animate: { y: 0, opacity: 1, scale: 1 },
    transition: {
      delay: 0.2,
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
      y: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] as const },
      opacity: { duration: 0.5, delay: 0.3 },
      scale: { duration: 0.6, delay: 0.2 }
    }
  }
};

// 안드로이드 환경 감지
const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);

// 기본 헤더 스타일
const defaultHeaderStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  transform: 'translateZ(0)',
  WebkitTransform: 'translateZ(0)',
  willChange: 'transform',
  WebkitPerspective: 1000,
  WebkitBackfaceVisibility: 'hidden',
          paddingTop: '0px',
  minHeight: 'auto',
  height: 'auto',
  zIndex: 50,
  // 안드로이드 최적화
  ...(isAndroid && {
    transform: 'translate3d(0, 0, 0)',
    WebkitTransform: 'translate3d(0, 0, 0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    perspective: 1000,
    WebkitPerspective: 1000,
    willChange: 'transform, opacity',
    // 안드로이드에서 애니메이션 성능 향상
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'none',
    touchAction: 'manipulation'
  })
};

const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  children,
  className = 'glass-effect header-fixed',
  style = {},
  variant = 'simple',
  delay,
  duration
}) => {
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const animation = headerAnimations[variant];
  
  // 커스텀 delay나 duration이 제공된 경우 사용
  const customTransition = {
    ...animation.transition,
    ...(delay !== undefined && { delay }),
    ...(duration !== undefined && { duration })
  };

  // 안드로이드에서 애니메이션 지연 시간 조정
  const androidAdjustedTransition = isAndroid ? {
    ...customTransition,
    delay: (customTransition.delay || 0) + 0.1, // 안드로이드에서 약간 더 지연
    duration: (customTransition.duration || 0.4) * 1.2 // 안드로이드에서 약간 더 긴 지속시간
  } : customTransition;

  // 한 번 애니메이션이 실행된 후에는 더 이상 초기 애니메이션을 실행하지 않음
  React.useEffect(() => {
    if (!hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, (androidAdjustedTransition.delay || 0) * 1000 + (androidAdjustedTransition.duration || 0.4) * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasAnimated, androidAdjustedTransition.delay, androidAdjustedTransition.duration]);

  return (
    <motion.header
      initial={hasAnimated ? animation.animate : animation.initial}
      animate={animation.animate}
      transition={hasAnimated ? { duration: 0 } : androidAdjustedTransition}
      className={`${className} ${isAndroid ? 'android-optimized' : ''}`}
      style={{
        ...defaultHeaderStyle,
        ...style
      }}
      // 안드로이드에서 애니메이션 우선순위 설정
      {...(isAndroid && {
        layout: false,
        layoutId: undefined
      })}
    >
      {children}
    </motion.header>
  );
};

export default AnimatedHeader; 