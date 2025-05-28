'use client';

import React, { useState, useEffect } from 'react';
import scheduleService, { 
  Schedule, 
  GroupMember, 
  UserPermission, 
  CreateScheduleRequest, 
  UpdateScheduleRequest 
} from '@/services/scheduleService';

interface GroupScheduleManagerProps {
  groupId: number;
  currentUserId?: number;
}

const GroupScheduleManager: React.FC<GroupScheduleManagerProps> = ({ 
  groupId, 
  currentUserId 
}) => {
  // 상태 관리
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [userPermission, setUserPermission] = useState<UserPermission>({
    canManage: false,
    isOwner: false,
    isLeader: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  // 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<Partial<CreateScheduleRequest>>({
    sst_title: '',
    sst_sdate: '',
    sst_edate: '',
    sst_all_day: 'Y',
    sst_location_title: '',
    sst_location_add: '',
    sst_memo: '',
    sst_supplies: '',
    sst_alram: 1,
    sst_schedule_alarm_chk: 'Y'
  });

  // 스케줄 목록 조회
  const loadSchedules = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const options = selectedMemberId ? { memberId: selectedMemberId } : undefined;
      const response = await scheduleService.getGroupSchedules(groupId, options);

      if (response.success) {
        setSchedules(response.data.schedules);
        setGroupMembers(response.data.groupMembers);
        setUserPermission(response.data.userPermission);
      } else {
        setError('스케줄을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('스케줄 조회 중 오류가 발생했습니다.');
      console.error('스케줄 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 특정 날짜 스케줄 조회
  const loadSchedulesByDate = async (date: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await scheduleService.getGroupSchedulesByDate(groupId, date);

      if (response.success) {
        setSchedules(response.data.schedules);
      } else {
        setError('해당 날짜의 스케줄을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('스케줄 조회 중 오류가 발생했습니다.');
      console.error('날짜별 스케줄 조회 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄 생성
  const handleCreateSchedule = async () => {
    if (!formData.sst_title || !formData.sst_sdate || !formData.sst_edate) {
      setError('제목, 시작 시간, 종료 시간은 필수입니다.');
      return;
    }

    // 시간 유효성 검증
    const validation = scheduleService.validateScheduleTime(
      formData.sst_sdate!,
      formData.sst_edate!
    );

    if (!validation.isValid) {
      setError(validation.error!);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const createData: CreateScheduleRequest = {
        groupId,
        ...formData as CreateScheduleRequest
      };

      const response = await scheduleService.createSchedule(createData);

      if (response.success) {
        setIsCreateModalOpen(false);
        resetForm();
        await loadSchedules();
        alert('스케줄이 성공적으로 생성되었습니다.');
      } else {
        setError(response.error || '스케줄 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('스케줄 생성 중 오류가 발생했습니다.');
      console.error('스케줄 생성 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄 수정
  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;

    setIsLoading(true);
    setError(null);

    try {
      const updateData: UpdateScheduleRequest = {
        sst_idx: parseInt(editingSchedule.id || '0'),
        groupId,
        sst_title: formData.sst_title || '',
        sst_sdate: formData.sst_sdate || '',
        sst_edate: formData.sst_edate || '',
        sst_all_day: formData.sst_all_day,
        sst_location_title: formData.sst_location_title,
        sst_location_add: formData.sst_location_add,
        sst_memo: formData.sst_memo,
        sst_supplies: formData.sst_supplies,
        sst_alram: formData.sst_alram,
        sst_schedule_alarm_chk: formData.sst_schedule_alarm_chk
      };

      const response = await scheduleService.updateSchedule(updateData);

      if (response.success) {
        setIsEditModalOpen(false);
        setEditingSchedule(null);
        resetForm();
        await loadSchedules();
        alert('스케줄이 성공적으로 수정되었습니다.');
      } else {
        setError(response.error || '스케줄 수정에 실패했습니다.');
      }
    } catch (err) {
      setError('스케줄 수정 중 오류가 발생했습니다.');
      console.error('스케줄 수정 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 스케줄 삭제
  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!confirm(`"${schedule.title}" 스케줄을 삭제하시겠습니까?`)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await scheduleService.deleteSchedule(parseInt(schedule.id || '0'), groupId);

      if (response.success) {
        await loadSchedules();
        alert('스케줄이 성공적으로 삭제되었습니다.');
      } else {
        setError(response.error || '스케줄 삭제에 실패했습니다.');
      }
    } catch (err) {
      setError('스케줄 삭제 중 오류가 발생했습니다.');
      console.error('스케줄 삭제 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 수정 모달 열기
  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      sst_title: schedule.title || '',
      sst_sdate: schedule.date || '',
      sst_edate: schedule.sst_edate || '',
      sst_all_day: schedule.sst_all_day,
      sst_location_title: schedule.location || '',
      sst_location_add: schedule.sst_location_add || '',
      sst_memo: schedule.sst_memo || '',
      sst_supplies: schedule.sst_supplies || '',
      sst_alram: schedule.sst_alram || 1,
      sst_schedule_alarm_chk: schedule.sst_schedule_alarm_chk
    });
    setIsEditModalOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      sst_title: '',
      sst_sdate: '',
      sst_edate: '',
      sst_all_day: 'Y',
      sst_location_title: '',
      sst_location_add: '',
      sst_memo: '',
      sst_supplies: '',
      sst_alram: 1,
      sst_schedule_alarm_chk: 'Y'
    });
  };

  // 권한 확인
  const canManageSchedule = (schedule: Schedule): boolean => {
    return scheduleService.canManageSchedule(
      userPermission,
      parseInt(schedule.memberId || '0'),
      currentUserId
    );
  };

  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    loadSchedules();
  }, [groupId, selectedMemberId]);

  // 날짜 변경 시 해당 날짜 스케줄 조회
  useEffect(() => {
    if (selectedDate) {
      loadSchedulesByDate(selectedDate);
    }
  }, [selectedDate]);

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">그룹 스케줄 관리</h2>
        <p className="text-gray-600">
          {userPermission.isOwner && '🏅 그룹장'}
          {userPermission.isLeader && !userPermission.isOwner && '👑 리더'}
          {!userPermission.canManage && '👤 일반 멤버'}
          {userPermission.canManage && ' - 모든 멤버 스케줄 관리 가능'}
        </p>
      </div>

      {/* 필터 및 액션 버튼 */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-4">
          {/* 날짜 선택 */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* 멤버 필터 */}
          <select
            value={selectedMemberId || ''}
            onChange={(e) => setSelectedMemberId(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">모든 멤버</option>
            {groupMembers.map((member) => (
              <option key={member.mt_idx} value={member.mt_idx}>
                {member.mt_name}
                {member.sgdt_owner_chk === 'Y' && ' (그룹장)'}
                {member.sgdt_leader_chk === 'Y' && ' (리더)'}
              </option>
            ))}
          </select>
        </div>

        {/* 스케줄 생성 버튼 */}
        <button
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          스케줄 추가
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      )}

      {/* 스케줄 목록 */}
      {!isLoading && (
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>표시할 스케줄이 없습니다.</p>
            </div>
          ) : (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {schedule.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-1">
                      👤 {schedule.member_name}
                    </p>
                    <p className="text-sm text-gray-600 mb-1">
                      📅 {schedule.date && new Date(schedule.date).toLocaleString('ko-KR')} ~ 
                         {schedule.sst_edate && new Date(schedule.sst_edate).toLocaleString('ko-KR')}
                    </p>
                    {schedule.location && (
                      <p className="text-sm text-gray-600 mb-1">
                        📍 {schedule.location}
                      </p>
                    )}
                    {schedule.sst_memo && (
                      <p className="text-sm text-gray-600 mb-1">
                        💭 {schedule.sst_memo}
                      </p>
                    )}
                    {schedule.sst_supplies && (
                      <p className="text-sm text-gray-600">
                        🎒 준비물: {schedule.sst_supplies}
                      </p>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  {canManageSchedule(schedule) && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openEditModal(schedule)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(schedule)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 스케줄 생성/수정 모달 */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {isCreateModalOpen ? '스케줄 추가' : '스케줄 수정'}
            </h3>

            <div className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 *
                </label>
                <input
                  type="text"
                  value={formData.sst_title || ''}
                  onChange={(e) => setFormData({ ...formData, sst_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="스케줄 제목을 입력하세요"
                />
              </div>

              {/* 시작 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시작 시간 *
                </label>
                <input
                  type="datetime-local"
                  value={formData.sst_sdate || ''}
                  onChange={(e) => setFormData({ ...formData, sst_sdate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 종료 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종료 시간 *
                </label>
                <input
                  type="datetime-local"
                  value={formData.sst_edate || ''}
                  onChange={(e) => setFormData({ ...formData, sst_edate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 하루 종일 체크박스 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="all-day"
                  checked={formData.sst_all_day === 'Y'}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    sst_all_day: e.target.checked ? 'Y' : 'N' 
                  })}
                  className="mr-2"
                />
                <label htmlFor="all-day" className="text-sm text-gray-700">
                  하루 종일
                </label>
              </div>

              {/* 장소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  장소
                </label>
                <input
                  type="text"
                  value={formData.sst_location_title || ''}
                  onChange={(e) => setFormData({ ...formData, sst_location_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="장소를 입력하세요"
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모
                </label>
                <textarea
                  value={formData.sst_memo || ''}
                  onChange={(e) => setFormData({ ...formData, sst_memo: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="메모를 입력하세요"
                />
              </div>

              {/* 준비물 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  준비물
                </label>
                <input
                  type="text"
                  value={formData.sst_supplies || ''}
                  onChange={(e) => setFormData({ ...formData, sst_supplies: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="준비물을 입력하세요"
                />
              </div>
            </div>

            {/* 모달 버튼 */}
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                  setEditingSchedule(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={isCreateModalOpen ? handleCreateSchedule : handleUpdateSchedule}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? '처리 중...' : (isCreateModalOpen ? '추가' : '수정')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupScheduleManager; 