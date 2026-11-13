'use client';

import { useState } from 'react';
import { Icon } from './Marketing';

interface ShortsSliderProps {
  isGuideSlider?: boolean;
}

export default function ShortsSlider({ isGuideSlider = false }: ShortsSliderProps) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const videos = isGuideSlider
    ? [
      { id: 'Ba83-yfjvBQ', title: '앱 설치부터 가족 연결까지', description: 'SMAP 소개와 기본 설정', icon: 'users' },
      { id: 'JgZov6z0Htg', title: '지금 어디에 있는지 확인하기', description: '자녀 위치 확인 가이드', icon: 'pin' },
      { id: 'Bvzaz5vFyAo', title: '우리 가족 일정 함께 관리하기', description: '가족 일정 관리 가이드', icon: 'calendar' },
    ]
    : [
      { id: 'lF1RfSb-XJg', title: '실시간 위치 확인', description: '위치 확인 기능 사용법', icon: 'pin' },
      { id: 'XUJpC8DaDsQ', title: '일정 관리', description: '일정 관리 기능 활용하기', icon: 'calendar' },
      { id: 'zFULBJR1934', title: '안전 알림', description: '안전 알림 설정 방법', icon: 'bell' },
      { id: 'jNpupeI4ACU', title: '이동 경로', description: '이동 경로 확인하기', icon: 'route' },
      { id: 'UPS_46Cjaz0', title: '나에게 맞는 설정', description: '앱 설정 변경하기', icon: 'shield' },
    ];

  return (
    <div className={`video-grid ${isGuideSlider ? '' : 'video-grid-short'}`}>
      {videos.map((video, index) => <article className="video-card" key={video.id}><div className="video-cover">{activeVideo === video.id ? <iframe src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`} title={video.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <button type="button" onClick={() => setActiveVideo(video.id)} aria-label={`${video.title} 영상 재생`}><span className="video-number">가이드 {String(index + 1).padStart(2, '0')}</span><span className="video-illustration"><Icon name={video.icon} /></span><span className="video-play"><Icon name="play" /></span><span className="video-cover-label">{video.description}</span></button>}</div><div className="video-card-copy"><h3>{video.title}</h3><p>{video.description}</p></div></article>)}
    </div>
  );
}
