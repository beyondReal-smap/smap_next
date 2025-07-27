'use client'

import Image from 'next/image'
import { useState, useCallback } from 'react'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  sizes?: string
  fill?: boolean
  quality?: number
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
  onError?: () => void
  aspectRatio?: number // CLS 방지를 위한 가로세로 비율
}

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  sizes,
  fill = false,
  quality = 85, // 품질 개선
  loading = 'lazy',
  onLoad,
  onError,
  aspectRatio = 1 // 기본 1:1 비율
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
    onError?.()
  }, [onError])

  // 개선된 블러 데이터 URL (4x4 회색 이미지)
  const defaultBlurDataURL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo='

  // CLS 방지를 위한 컨테이너 스타일
  const containerStyle = fill ? {} : {
    width: width || 'auto',
    height: height || 'auto',
    aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
  }

  // 에러 상태일 때 표시할 기본 이미지
  if (hasError) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center rounded ${className}`}
        style={containerStyle}
      >
        <svg 
          className="w-6 h-6 text-gray-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
      </div>
    )
  }

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={containerStyle}
    >
      {/* 로딩 스켈레톤 - CLS 방지 */}
      {isLoading && (
        <div 
          className="absolute inset-0 skeleton rounded"
          style={containerStyle}
        />
      )}
      
      {/* 최적화된 이미지 */}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurDataURL || defaultBlurDataURL}
        sizes={sizes || (fill ? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw' : undefined)}
        quality={quality}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${fill ? 'object-cover' : ''}`}
        style={fill ? {
          objectFit: 'cover',
          objectPosition: 'center'
        } : undefined}
      />
    </div>
  )
}

// 프리셋 컴포넌트들
export function ProfileImage({ 
  src, 
  alt, 
  size = 40, 
  className = '' 
}: { 
  src: string
  alt: string
  size?: number
  className?: string 
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      quality={90}
      priority={false}
      placeholder="blur"
    />
  )
}

export function CardImage({ 
  src, 
  alt, 
  className = '' 
}: { 
  src: string
  alt: string
  className?: string 
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      className={`rounded-lg ${className}`}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      quality={85}
      placeholder="blur"
    />
  )
}

export function HeroImage({ 
  src, 
  alt, 
  className = '' 
}: { 
  src: string
  alt: string
  className?: string 
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      className={className}
      sizes="100vw"
      quality={90}
      priority={true}
      placeholder="blur"
    />
  )
}

export function ThumbnailImage({ 
  src, 
  alt, 
  size = 80, 
  className = '' 
}: { 
  src: string
  alt: string
  size?: number
  className?: string 
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded ${className}`}
      quality={75}
      placeholder="blur"
    />
  )
} 