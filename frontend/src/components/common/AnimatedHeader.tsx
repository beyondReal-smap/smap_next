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
    initial: { y: -100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: {
      delay: 0.1,
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  enhanced: {
    initial: { y: -100, opacity: 0, scale: 0.9 },
    animate: { y: 0, opacity: 1, scale: 1 },
    transition: {
      delay: 0.2,
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
      opacity: { duration: 0.6 },
      scale: { duration: 0.6 }
    }
  }
};

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
  paddingTop: 'max(16px, env(safe-area-inset-top))'
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

  // 한 번 애니메이션이 실행된 후에는 더 이상 초기 애니메이션을 실행하지 않음
  React.useEffect(() => {
    if (!hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, (customTransition.delay || 0) * 1000 + (customTransition.duration || 0.4) * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [hasAnimated, customTransition.delay, customTransition.duration]);

  return (
    <motion.header
      initial={hasAnimated ? animation.animate : animation.initial}
      animate={animation.animate}
      transition={hasAnimated ? { duration: 0 } : customTransition}
      className={className}
      style={{
        ...defaultHeaderStyle,
        ...style
      }}
    >
      {children}
    </motion.header>
  );
};

export default AnimatedHeader; 