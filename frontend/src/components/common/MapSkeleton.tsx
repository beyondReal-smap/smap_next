'use client';

import React from 'react';
import styles from './MapSkeleton.module.css';

interface MapSkeletonProps {
  showControls?: boolean;
  showMemberList?: boolean;
  className?: string;
}

export const MapSkeleton: React.FC<MapSkeletonProps> = ({ 
  showControls = true, 
  showMemberList = false,
  className = ''
}) => {
  return (
    <div className={`${styles.mapSkeleton} ${className}`}>
      {/* 지도 메인 영역 */}
      <div className={styles.mapContainer}>
        {/* 지도 영역 */}
        <div className={styles.mapArea}>
          {/* 지도 그리드 패턴 */}
          <div className={styles.mapGrid}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={styles.gridItem} />
            ))}
          </div>
          
          {/* 가짜 마커들 */}
          <div className={styles.markerContainer}>
            <div className={`${styles.marker} ${styles.marker1}`}>
              <div className={styles.markerIcon} />
              <div className={styles.markerPulse} />
            </div>
            <div className={`${styles.marker} ${styles.marker2}`}>
              <div className={styles.markerIcon} />
              <div className={styles.markerPulse} />
            </div>
            <div className={`${styles.marker} ${styles.marker3}`}>
              <div className={styles.markerIcon} />
              <div className={styles.markerPulse} />
            </div>
          </div>

          {/* 로딩 오버레이 */}
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinnerIcon}>
                <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* 구글 스타일 점들이 돌아가는 로딩 애니메이션 */}
                  <g className={styles.spinnerDots}>
                    {/* 12개의 점을 원형으로 배치 */}
                    {[...Array(12)].map((_, i) => {
                      const angle = (i * 30) * Math.PI / 180; // 30도씩
                      const x = 20 + Math.cos(angle) * 12;
                      const y = 20 + Math.sin(angle) * 12;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r="2"
                          fill="currentColor"
                          opacity="0.3"
                          className={styles.spinnerDot}
                          style={{ 
                            animationDelay: `${i * 0.1}s`,
                            transformOrigin: '20px 20px'
                          }}
                        />
                      );
                    })}
                  </g>
                </svg>
              </div>
              <div className={styles.loadingText}>지도를 불러오는 중...</div>
              <div className={styles.loadingProgress}>
                <div className={styles.progressBar} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 멤버 리스트 (home 페이지용) */}
      {showMemberList && (
        <div className={styles.memberList}>
          <div className={styles.memberListHeader}>
            <div className={styles.headerText} />
          </div>
          <div className={styles.memberItems}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.memberItem}>
                <div className={styles.memberAvatar} />
                <div className={styles.memberInfo}>
                  <div className={styles.memberName} />
                  <div className={styles.memberStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 