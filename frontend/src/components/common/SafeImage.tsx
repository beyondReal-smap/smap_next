import React, { useState, useCallback } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string;
  className?: string;
  onError?: (error: Event) => void;
  onLoad?: (event: Event) => void;
  gender?: number;
  size?: 'sm' | 'md' | 'lg';
}

const DEFAULT_AVATARS = {
  male: '/images/default-male-avatar.png',
  female: '/images/default-female-avatar.png',
  unknown: '/images/default-avatar.png'
};

const SIZE_CLASSES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12', 
  lg: 'w-16 h-16'
};

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  fallbackSrc,
  className = '',
  onError,
  onLoad,
  gender,
  size = 'md'
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 기본 아바타 선택
  const getDefaultAvatar = useCallback(() => {
    if (fallbackSrc) return fallbackSrc;
    
    switch (gender) {
      case 1:
        return DEFAULT_AVATARS.male;
      case 2:
        return DEFAULT_AVATARS.female;
      default:
        return DEFAULT_AVATARS.unknown;
    }
  }, [fallbackSrc, gender]);

  const handleError = useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.warn('[SafeImage] 이미지 로딩 실패:', currentSrc);
    
    if (!hasError) {
      // 첫 번째 에러 시 기본 아바타로 대체
      const defaultAvatar = getDefaultAvatar();
      setCurrentSrc(defaultAvatar);
      setHasError(true);
    }
    
    setIsLoading(false);
    
    if (onError) {
      onError(event.nativeEvent);
    }
  }, [currentSrc, hasError, getDefaultAvatar, onError]);

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    
    if (onLoad) {
      onLoad(event.nativeEvent);
    }
  }, [onLoad]);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={`relative ${sizeClass} ${className}`}>
      {isLoading && (
        <div className={`absolute inset-0 ${sizeClass} bg-gray-200 rounded-full flex items-center justify-center`}>
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      <img
        src={currentSrc}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onError={handleError}
        onLoad={handleLoad}
        onLoadStart={handleLoadStart}
        loading="lazy"
      />
      
      {/* SSL 에러 표시 (개발 모드에서만) */}
      {hasError && process.env.NODE_ENV === 'development' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs">!</span>
        </div>
      )}
    </div>
  );
};

// 멤버 프로필 이미지용 특화 컴포넌트
export const MemberAvatar: React.FC<{
  member: {
    mt_file1?: string;
    mt_gender?: number;
    mt_name: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ member, size = 'md', className = '' }) => {
  // 서버 URL 정리 (SSL 에러 방지)
  const getCleanImageUrl = useCallback((url: string | undefined) => {
    if (!url) return '';
    
    // HTTP/HTTPS 프로토콜 제거하여 상대적 URL로 변환
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // SSL 에러를 피하기 위해 프록시를 통한 이미지 로딩
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  }, []);

  const imageSrc = getCleanImageUrl(member.mt_file1);

  return (
    <SafeImage
      src={imageSrc}
      alt={`${member.mt_name} 프로필`}
      gender={member.mt_gender}
      size={size}
      className={className}
      onError={(error) => {
        console.warn(`[MemberAvatar] ${member.mt_name} 프로필 이미지 로딩 실패:`, error);
      }}
    />
  );
}; 