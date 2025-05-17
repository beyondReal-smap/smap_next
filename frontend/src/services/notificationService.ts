import apiClient from './apiClient';
import { PushLog, DeleteAllResponse } from '@/types/push';

class NotificationService {
  /**
   * 멤버의 푸시 알림 내역 조회
   */
  async getMemberPushLogs(memberId: number | string): Promise<PushLog[]> {
    const response = await apiClient.get<PushLog[]>(`/push-logs/member/${memberId}`);
    return response.data;
  }

  /**
   * 알림 전체 삭제
   */
  async deleteAllNotifications(memberId: number | string): Promise<DeleteAllResponse> {
    const response = await apiClient.post<DeleteAllResponse>('/push-logs/delete-all', { mt_idx: memberId });
    return response.data;
  }

  /**
   * 특정 알림 삭제
   */
  async deleteNotification(notificationId: number | string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/push-logs/${notificationId}`);
    return response.data;
  }

  /**
   * 알림 읽음 처리
   */
  async markAsRead(notificationId: number | string): Promise<{ success: boolean }> {
    const response = await apiClient.patch(`/push-logs/${notificationId}/read`);
    return response.data;
  }

  /**
   * 알림 등록 (관리자 기능)
   */
  async registerNotification(data: FormData): Promise<{ success: boolean; message: string }> {
    return apiClient.upload('/notice', data);
  }
}

// 싱글톤 인스턴스 생성
const notificationService = new NotificationService();
export default notificationService; 