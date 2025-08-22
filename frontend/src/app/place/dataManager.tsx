'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiLoader, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

// 타입 정의
interface LocationData {
  id: string; 
  name: string;
  address: string;
  category: string;
  coordinates: [number, number];
  memo: string;
  favorite: boolean;
  notifications?: boolean;
}

interface GroupMember {
  id: string;
  name: string;
  photo: string | null;
  isSelected: boolean;
  location: { lat: number; lng: number };
  schedules: any[];
  savedLocations: LocationData[];
  savedLocationCount?: number;
  mt_gender?: number | null;
  original_index: number;
  mlt_lat?: number | null;
  mlt_long?: number | null;
}

interface DataManagerProps {
  onMembersLoaded: (members: GroupMember[]) => void;
  onLocationsLoaded: (locations: LocationData[]) => void;
  onError: (message: string) => void;
}

export default function DataManager({
  onMembersLoaded,
  onLocationsLoaded,
  onError
}: DataManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 샘플 데이터 생성 (실제로는 API에서 가져옴)
  const generateSampleData = useCallback(() => {
    const sampleMembers: GroupMember[] = [
      {
        id: '1',
        name: '김철수',
        photo: null,
        isSelected: true,
        location: { lat: 37.5665, lng: 126.9780 },
        schedules: [
          { id: '1', title: '팀 미팅', date: '2024-01-15', location: '회사' },
          { id: '2', title: '점심 약속', date: '2024-01-15', location: '맛집' }
        ],
        savedLocations: [
          {
            id: '1',
            name: '회사',
            address: '서울특별시 강남구 테헤란로 123',
            category: '회사',
            coordinates: [126.9780, 37.5665],
            memo: '출근하는 곳',
            favorite: true,
            notifications: true
          },
          {
            id: '2',
            name: '집',
            address: '서울특별시 서초구 서초대로 456',
            category: '집',
            coordinates: [127.0280, 37.4965],
            memo: '우리집',
            favorite: true,
            notifications: false
          },
          {
            id: '3',
            name: '맛집',
            address: '서울특별시 강남구 가로수길 789',
            category: '음식점',
            coordinates: [127.0180, 37.5265],
            memo: '점심 먹는 곳',
            favorite: false,
            notifications: true
          }
        ],
        savedLocationCount: 3,
        mt_gender: 1,
        original_index: 0,
        mlt_lat: 37.5665,
        mlt_long: 126.9780
      },
      {
        id: '2',
        name: '이영희',
        photo: null,
        isSelected: false,
        location: { lat: 37.5565, lng: 126.9680 },
        schedules: [
          { id: '3', title: '쇼핑', date: '2024-01-15', location: '백화점' }
        ],
        savedLocations: [
          {
            id: '4',
            name: '백화점',
            address: '서울특별시 강남구 신사동 123',
            category: '쇼핑',
            coordinates: [127.0180, 37.5165],
            memo: '쇼핑하는 곳',
            favorite: false,
            notifications: false
          }
        ],
        savedLocationCount: 1,
        mt_gender: 2,
        original_index: 1,
        mlt_lat: 37.5565,
        mlt_long: 126.9680
      },
      {
        id: '3',
        name: '박민수',
        photo: null,
        isSelected: false,
        location: { lat: 37.5765, lng: 126.9880 },
        schedules: [],
        savedLocations: [
          {
            id: '5',
            name: '카페',
            address: '서울특별시 강남구 논현동 456',
            category: '카페',
            coordinates: [127.0280, 37.5365],
            memo: '공부하는 곳',
            favorite: true,
            notifications: true
          }
        ],
        savedLocationCount: 1,
        mt_gender: 1,
        original_index: 2,
        mlt_lat: 37.5765,
        mlt_long: 126.9880
      }
    ];

    return sampleMembers;
  }, []);

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 실제 API 호출을 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1500));

      const members = generateSampleData();
      
      // 첫 번째 멤버를 선택된 상태로 설정
      const updatedMembers = members.map((member, index) => ({
        ...member,
        isSelected: index === 0
      }));

      onMembersLoaded(updatedMembers);
      
      // 선택된 멤버의 장소 데이터 전달
      const selectedMember = updatedMembers.find(m => m.isSelected);
      if (selectedMember) {
        onLocationsLoaded(selectedMember.savedLocations);
      }

      setIsLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '데이터 로드 중 오류가 발생했습니다.';
      setError(errorMessage);
      onError(errorMessage);
      setIsLoading(false);
    }
  }, [generateSampleData, onMembersLoaded, onLocationsLoaded, onError]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"
          />
          <p className="text-lg font-medium text-gray-900 mb-2">데이터를 불러오는 중...</p>
          <p className="text-sm text-gray-600">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 에러 상태 표시
  if (error) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">데이터 로드 실패</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// 데이터 유틸리티 함수들
export const updateMemberSelection = (
  members: GroupMember[],
  selectedMemberId: string
): GroupMember[] => {
  return members.map(member => ({
    ...member,
    isSelected: member.id === selectedMemberId
  }));
};

export const updateMemberLocations = (
  members: GroupMember[],
  memberId: string,
  locations: LocationData[]
): GroupMember[] => {
  return members.map(member => 
    member.id === memberId 
      ? { ...member, savedLocations: locations, savedLocationCount: locations.length }
      : member
  );
};

export const addLocationToMember = (
  members: GroupMember[],
  memberId: string,
  location: LocationData
): GroupMember[] => {
  return members.map(member => 
    member.id === memberId 
      ? { 
          ...member, 
          savedLocations: [...member.savedLocations, location],
          savedLocationCount: (member.savedLocationCount || 0) + 1
        }
      : member
  );
};

export const updateLocationInMember = (
  members: GroupMember[],
  memberId: string,
  locationId: string,
  updates: Partial<LocationData>
): GroupMember[] => {
  return members.map(member => 
    member.id === memberId 
      ? {
          ...member,
          savedLocations: member.savedLocations.map(loc =>
            loc.id === locationId ? { ...loc, ...updates } : loc
          )
        }
      : member
  );
};

export const removeLocationFromMember = (
  members: GroupMember[],
  memberId: string,
  locationId: string
): GroupMember[] => {
  return members.map(member => 
    member.id === memberId 
      ? {
          ...member,
          savedLocations: member.savedLocations.filter(loc => loc.id !== locationId),
          savedLocationCount: Math.max(0, (member.savedLocationCount || 0) - 1)
        }
      : member
  );
};

export const getSelectedMember = (members: GroupMember[]): GroupMember | null => {
  return members.find(member => member.isSelected) || null;
};

export const getSelectedMemberLocations = (members: GroupMember[]): LocationData[] => {
  const selectedMember = getSelectedMember(members);
  return selectedMember ? selectedMember.savedLocations : [];
};
