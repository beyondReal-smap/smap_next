package service

import (
	"context"
	"time"
)

// groupChatRoomRepo는 그룹 생성/가입 시 채팅방 동기화 쿼리다(구현: repository.ChatRepository).
type groupChatRoomRepo interface {
	CreateGroupChatRoom(sgtIdx int, title *string, memberIDs []int, now time.Time) error
	AddMemberToGroupChat(sgtIdx, mtIdx int, now time.Time) error
}

// groupChatDeactivator는 탈퇴·강퇴·삭제 때 채팅 참가를 끄는 서비스다(구현: ChatService — 소켓 멤버십 캐시를 함께 비운다).
type groupChatDeactivator interface {
	DeactivateChatMembership(ctx context.Context, sgtIdx, mtIdx int) error
	DeactivateGroupChat(ctx context.Context, sgtIdx int) error
}

// GroupChatSync는 groupChatWriter 구현이다. 채팅방 생성/참가 추가는 저장소로, 비활성화는 캐시 무효화가 있는
// ChatService로 보낸다.
type GroupChatSync struct {
	groupChatRoomRepo
	groupChatDeactivator
}

func NewGroupChatSync(repo groupChatRoomRepo, chat groupChatDeactivator) *GroupChatSync {
	return &GroupChatSync{groupChatRoomRepo: repo, groupChatDeactivator: chat}
}
