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
                  {/* 외부 정사각형 */}
                  <rect x="2" y="2" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                  
                  {/* 중간 원형 */}
                  <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="2" opacity="0.6" strokeDasharray="8 4"/>
                  
                  {/* 내부 삼각형 */}
                  <polygon points="20,8 28,24 12,24" fill="currentColor" opacity="0.4"/>
                  
                  {/* 중심 육각형 */}
                  <polygon points="20,12 24,16 24,24 20,28 16,24 16,16" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.8"/>
                  
                  {/* 중심점 */}
                  <circle cx="20" cy="20" r="2" fill="currentColor"/>
                </svg>
              </div>
              <div className={styles.loadingText}>지도를 불러오는 중...</div>
              <div className={styles.loadingProgress}>
                <div className={styles.progressBar} />
              </div>
            </div>
          </div>
        </div>

        {/* 지도 컨트롤 버튼들 */}
        {showControls && (
          <div className={styles.controls}>
            {/* 지도 타입 선택 */}
            <div className={styles.mapTypeControl}>
              <div className={styles.controlButton} />
              <div className={styles.controlButton} />
            </div>
            
            {/* 줌 컨트롤 */}
            <div className={styles.zoomControl}>
              <div className={styles.controlButton} />
              <div className={styles.controlButton} />
            </div>
            
            {/* 현재 위치 버튼 */}
            <div className={styles.locationControl}>
              <div className={styles.controlButton} />
            </div>
          </div>
        )}
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