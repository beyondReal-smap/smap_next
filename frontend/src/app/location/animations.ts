import { cubicBezier } from 'framer-motion';

// 페이지 애니메이션
export const pageVariants = {
  initial: { opacity: 0, y: 30 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -30 }
};

// 사이드바 애니메이션
export const sidebarVariants = {
  open: {
    x: 0,
    transition: { 
      type: "spring" as const, 
      stiffness: 300, 
      damping: 30,
      when: "beforeChildren"
    }
  },
  closed: {
    x: "-100%",
    transition: { 
      type: "spring" as const, 
      stiffness: 300, 
      damping: 30,
      when: "afterChildren"
    }
  }
};

// 사이드바 컨텐츠 애니메이션
export const sidebarContentVariants = {
  open: {
    transition: { staggerChildren: 0.07, delayChildren: 0.2 }
  },
  closed: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 }
  }
};

// 멤버 아이템 애니메이션
export const memberItemVariants = {
  open: {
    y: 0,
    opacity: 1,
    transition: {
      y: { stiffness: 1000, velocity: -100 }
    }
  },
  closed: {
    y: 50,
    opacity: 0,
    transition: {
      y: { stiffness: 1000 }
    }
  }
};

// 모달 애니메이션
export const modalVariants = {
  hidden: { 
    opacity: 0, 
    y: 50,
    scale: 0.9
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    y: 50,
    scale: 0.9,
    transition: {
      duration: 0.2,
      ease: "easeIn"
    }
  }
};

// 토스트 애니메이션
export const toastVariants = {
  hidden: { 
    opacity: 0, 
    x: -100, 
    scale: 0.9 
  },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { 
      duration: 0.3, 
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    x: -100, 
    scale: 0.9,
    transition: { 
      duration: 0.3 
    }
  }
};

// 패널 애니메이션
export const panelVariants = {
  hidden: { 
    opacity: 0, 
    y: -30, 
    scale: 0.96 
  },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      duration: 0.3 
    }
  },
  exit: { 
    opacity: 0, 
    y: -30, 
    scale: 0.96,
    transition: { 
      duration: 0.3 
    }
  }
};

// 버튼 호버 애니메이션
export const buttonHoverVariants = {
  hover: { scale: 1.05 },
  tap: { scale: 0.95 }
};

// 아이콘 회전 애니메이션
export const iconRotateVariants = {
  hover: { 
    scale: 1.05, 
    rotate: 90,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.95 }
};

// 멤버 카드 호버 애니메이션
export const memberCardVariants = {
  hover: { 
    scale: 1.02,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.98 }
};

// 장소 리스트 아이템 애니메이션
export const locationItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (index: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: index * 0.1 }
  })
};

// 로딩 스피너 애니메이션
export const spinnerVariants = {
  spin: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// 진행 바 애니메이션
export const progressBarVariants = {
  initial: { width: "0%" },
  animate: { 
    width: "100%",
    transition: { 
      duration: 3,
      ease: "linear"
    }
  }
};
