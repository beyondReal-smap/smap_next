import apiClient from './apiClient';

export interface PushNotificationRequest {
  plt_type: string;
  sst_idx: number;
  plt_condition: string;
  plt_memo: string;
  mt_id: string;
  plt_title: string;
  plt_content: string;
}

export interface GroupMemberInfo {
  mt_idx: number;
  mt_name: string;
  mt_nickname?: string;
  mt_id?: string;
  mt_email?: string;
  mt_lang?: string;
  sgdt_owner_chk: 'Y' | 'N';
  sgdt_leader_chk: 'Y' | 'N';
}

export interface ScheduleNotificationContext {
  scheduleId: number;
  scheduleTitle: string;
  currentUser: {
    mt_idx: number;
    mt_name: string;
    mt_nickname?: string;
    sgdt_owner_chk: 'Y' | 'N';
    sgdt_leader_chk: 'Y' | 'N';
  };
  targetMember?: GroupMemberInfo;
  groupMembers: GroupMemberInfo[];
  action: 'create' | 'update' | 'delete';
}

class PushNotificationService {
  /**
   * 푸시 알림 전송 API 호출
   */
  private async sendPushNotification(data: PushNotificationRequest): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      console.log('[PUSH SERVICE] 📤 푸시 알림 전송:', data);
      
             const response = await apiClient.post('/fcm_sendone/', data);
       
       console.log('[PUSH SERVICE] ✅ 푸시 알림 전송 성공:', response.data);
       return { success: true, data: response.data };
    } catch (error: any) {
      console.error('[PUSH SERVICE] ❌ 푸시 알림 전송 실패:', error);
      return {
        success: false,
        error: error.message || '푸시 알림 전송에 실패했습니다.'
      };
    }
  }

  /**
   * 다국어 메시지 가져오기 (임시로 한국어만 구현)
   */
  private getTranslations(lang: string = 'ko') {
    // 실제로는 백엔드에서 언어 파일을 가져와야 하지만, 임시로 하드코딩
    return {
      // 일정 생성 알림
      txt_schedule_created: '일정 생성 알림 ➕',
      txt_schedule_created_content: '{nick_name}님이 새로운 일정을 생성했습니다.',
      txt_schedule_created_content_member: '{nick_name}님이 회원님의 새로운 일정을 생성했습니다.',
      
      // 일정 수정 알림
      txt_schedule_updated: '일정 수정 알림 ✏️',
      txt_schedule_updated_content: '{nick_name}님이 "{sst_title}" 일정을 수정했습니다.',
      txt_schedule_updated_content_member: '{nick_name}님이 회원님의 "{sst_title}" 일정을 수정했습니다.',
      
      // 일정 삭제 알림
      txt_schedule_deleted: '일정 삭제 알림 ❌',
      txt_schedule_deleted_content: '{nick_name}님이 "{sst_title}" 일정을 삭제했습니다.',
      txt_schedule_deleted_content_member: '{nick_name}님이 회원님의 "{sst_title}" 일정을 삭제했습니다.',
    };
  }

  /**
   * 닉네임 또는 이름 가져오기
   */
  private getMemberDisplayName(member: GroupMemberInfo): string {
    return member.mt_nickname || member.mt_name;
  }

  /**
   * 멤버 ID 가져오기 (mt_id 또는 mt_email)
   */
  private getMemberId(member: GroupMemberInfo): string {
    return member.mt_id || member.mt_email || member.mt_idx.toString();
  }

  /**
   * 일정 생성 시 푸시 알림 처리
   */
  async handleScheduleCreatedNotification(context: ScheduleNotificationContext): Promise<void> {
    try {
      console.log('[PUSH SERVICE] 📝 일정 생성 알림 처리 시작:', context);

      const { currentUser, targetMember, groupMembers, scheduleId, scheduleTitle } = context;
      const translations = this.getTranslations();

      // 본인 일정인지 다른 멤버 일정인지 확인
      const isOwnSchedule = !targetMember || currentUser.mt_idx === targetMember.mt_idx;

      if (isOwnSchedule) {
        // 본인 일정인 경우
        const isOwnerOrLeader = currentUser.sgdt_owner_chk === 'Y' || currentUser.sgdt_leader_chk === 'Y';
        
        if (!isOwnerOrLeader) {
          // 본인이 그룹원인 경우 - 오너/리더들에게 알림
          await this.notifyOwnersAndLeaders(
            groupMembers,
            {
              plt_type: '2',
              sst_idx: scheduleId,
              plt_condition: '그룹원이 자신의 일정 입력',
              plt_memo: '해당 그룹의 그룹오너/리더에게 일정이 생성되었다는 푸시알림',
              plt_title: translations.txt_schedule_created,
              plt_content: translations.txt_schedule_created_content.replace('{nick_name}', this.getMemberDisplayName(currentUser)),
            }
          );
        }
      } else {
        // 다른 멤버 일정인 경우 - 해당 멤버에게 알림
        await this.notifyTargetMember(
          targetMember,
          {
            plt_type: '2',
            sst_idx: scheduleId,
            plt_condition: '그룹오너가 그룹원 일정 입력',
            plt_memo: '해당 그룹원에게 일정이 생성되었다는 푸시알림',
            plt_title: translations.txt_schedule_created,
            plt_content: translations.txt_schedule_created_content_member.replace('{nick_name}', this.getMemberDisplayName(currentUser)),
          }
        );
      }
    } catch (error) {
      console.error('[PUSH SERVICE] ❌ 일정 생성 알림 처리 실패:', error);
    }
  }

  /**
   * 일정 수정 시 푸시 알림 처리
   */
  async handleScheduleUpdatedNotification(context: ScheduleNotificationContext): Promise<void> {
    try {
      console.log('[PUSH SERVICE] ✏️ 일정 수정 알림 처리 시작:', context);

      const { currentUser, targetMember, groupMembers, scheduleId, scheduleTitle } = context;
      const translations = this.getTranslations();

      // 본인 일정인지 다른 멤버 일정인지 확인
      const isOwnSchedule = !targetMember || currentUser.mt_idx === targetMember.mt_idx;

      if (isOwnSchedule) {
        // 본인 일정인 경우
        const isOwnerOrLeader = currentUser.sgdt_owner_chk === 'Y' || currentUser.sgdt_leader_chk === 'Y';
        
        if (!isOwnerOrLeader) {
          // 본인이 그룹원인 경우 - 오너/리더들에게 알림
          await this.notifyOwnersAndLeaders(
            groupMembers,
            {
              plt_type: '2',
              sst_idx: scheduleId,
              plt_condition: '그룹원이 자신의 일정 수정',
              plt_memo: '해당 그룹의 그룹오너/리더에게 일정이 수정되었다는 푸시알림',
              plt_title: translations.txt_schedule_updated,
              plt_content: translations.txt_schedule_updated_content
                .replace('{nick_name}', this.getMemberDisplayName(currentUser))
                .replace('{sst_title}', scheduleTitle),
            }
          );
        }
      } else {
        // 다른 멤버 일정인 경우 - 해당 멤버에게 알림
        await this.notifyTargetMember(
          targetMember,
          {
            plt_type: '2',
            sst_idx: scheduleId,
            plt_condition: '그룹오너가 그룹원 일정 수정',
            plt_memo: '해당 그룹원에게 일정이 수정되었다는 푸시알림',
            plt_title: translations.txt_schedule_updated,
            plt_content: translations.txt_schedule_updated_content_member
              .replace('{nick_name}', this.getMemberDisplayName(currentUser))
              .replace('{sst_title}', scheduleTitle),
          }
        );
      }
    } catch (error) {
      console.error('[PUSH SERVICE] ❌ 일정 수정 알림 처리 실패:', error);
    }
  }

  /**
   * 일정 삭제 시 푸시 알림 처리
   */
  async handleScheduleDeletedNotification(context: ScheduleNotificationContext): Promise<void> {
    try {
      console.log('[PUSH SERVICE] 🗑️ 일정 삭제 알림 처리 시작:', context);

      const { currentUser, targetMember, groupMembers, scheduleId, scheduleTitle } = context;
      const translations = this.getTranslations();

      // 본인 일정인지 다른 멤버 일정인지 확인
      const isOwnSchedule = !targetMember || currentUser.mt_idx === targetMember.mt_idx;

      if (isOwnSchedule) {
        // 본인 일정인 경우
        const isOwnerOrLeader = currentUser.sgdt_owner_chk === 'Y' || currentUser.sgdt_leader_chk === 'Y';
        
        if (!isOwnerOrLeader) {
          // 본인이 그룹원인 경우 - 오너/리더들에게 알림
          await this.notifyOwnersAndLeaders(
            groupMembers,
            {
              plt_type: '2',
              sst_idx: scheduleId,
              plt_condition: '그룹원이 자신의 일정 삭제',
              plt_memo: '해당 그룹의 그룹오너/리더에게 일정이 삭제되었다는 푸시알림',
              plt_title: translations.txt_schedule_deleted,
              plt_content: translations.txt_schedule_deleted_content
                .replace('{nick_name}', this.getMemberDisplayName(currentUser))
                .replace('{sst_title}', scheduleTitle),
            }
          );
        }
      } else {
        // 다른 멤버 일정인 경우 - 해당 멤버에게 알림
        await this.notifyTargetMember(
          targetMember,
          {
            plt_type: '2',
            sst_idx: scheduleId,
            plt_condition: '그룹오너가 그룹원 일정 삭제',
            plt_memo: '해당 그룹원에게 일정이 삭제되었다는 푸시알림',
            plt_title: translations.txt_schedule_deleted,
            plt_content: translations.txt_schedule_deleted_content_member
              .replace('{nick_name}', this.getMemberDisplayName(currentUser))
              .replace('{sst_title}', scheduleTitle),
          }
        );
      }
    } catch (error) {
      console.error('[PUSH SERVICE] ❌ 일정 삭제 알림 처리 실패:', error);
    }
  }

  /**
   * 오너/리더들에게 알림 전송
   */
  private async notifyOwnersAndLeaders(
    groupMembers: GroupMemberInfo[],
    baseNotification: Omit<PushNotificationRequest, 'mt_id'>
  ): Promise<void> {
    const ownersAndLeaders = groupMembers.filter(
      member => member.sgdt_owner_chk === 'Y' || member.sgdt_leader_chk === 'Y'
    );

    console.log('[PUSH SERVICE] 👑 오너/리더들에게 알림 전송:', ownersAndLeaders.length, '명');

    for (const member of ownersAndLeaders) {
      const notification: PushNotificationRequest = {
        ...baseNotification,
        mt_id: this.getMemberId(member),
      };

      await this.sendPushNotification(notification);
    }
  }

  /**
   * 특정 멤버에게 알림 전송
   */
  private async notifyTargetMember(
    targetMember: GroupMemberInfo,
    baseNotification: Omit<PushNotificationRequest, 'mt_id'>
  ): Promise<void> {
    console.log('[PUSH SERVICE] 👤 특정 멤버에게 알림 전송:', this.getMemberDisplayName(targetMember));

    const notification: PushNotificationRequest = {
      ...baseNotification,
      mt_id: this.getMemberId(targetMember),
    };

    await this.sendPushNotification(notification);
  }

  /**
   * 일정 관련 푸시 알림 통합 처리
   */
  async handleScheduleNotification(context: ScheduleNotificationContext): Promise<void> {
    switch (context.action) {
      case 'create':
        await this.handleScheduleCreatedNotification(context);
        break;
      case 'update':
        await this.handleScheduleUpdatedNotification(context);
        break;
      case 'delete':
        await this.handleScheduleDeletedNotification(context);
        break;
      default:
        console.warn('[PUSH SERVICE] ⚠️ 알 수 없는 액션:', context.action);
    }
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService; 