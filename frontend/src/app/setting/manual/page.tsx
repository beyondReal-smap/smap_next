"use client";
import Header from '@/components/Header';
import React from 'react';

const videos = [
  { title: '소개1', url: 'https://www.youtube.com/embed/fRLxsHCvwuQ' },
  { title: '소개2', url: 'https://www.youtube.com/embed/xOqCizxr2uk' },
  { title: '그룹', url: 'https://www.youtube.com/embed/Bvzaz5vFyAo' },
  { title: '일정', url: 'https://www.youtube.com/embed/Ba83-yfjvBQ' },
  { title: '내장소', url: 'https://www.youtube.com/embed/EDcvCwZmF38' },
];

export default function ManualPage() {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <Header title="매뉴얼" />
      <div className="flex-1 px-4 py-12 space-y-8">
        {videos.map((video, idx) => (
          <div key={video.title}>
            <div className="text-lg font-bold mb-2">{video.title}</div>
            <div className="aspect-w-16 aspect-h-9 w-full rounded-xl overflow-hidden bg-black">
              <iframe
                src={video.url}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-56 rounded-xl border-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 