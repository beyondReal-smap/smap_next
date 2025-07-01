'use client';

import React from 'react';
import { motion } from 'framer-motion';
import IOSCompatibleSpinner from './IOSCompatibleSpinner';
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

          {/* 로딩 오버레이 - 컴팩트 스타일 */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <motion.div 
              className="bg-white px-5 py-4 rounded-lg shadow-lg w-auto mx-4"
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 25,
                duration: 0.5
              }}
            >
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: 0.2,
                  duration: 0.4
                }}
              >
              </motion.div>

              <motion.div 
                className="flex justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: 0.3,
                  duration: 0.4
                }}
              >
                <div style={{ 
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden'
                }}>
                  <IOSCompatibleSpinner size="md" />
                </div>
              </motion.div>
            </motion.div>
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