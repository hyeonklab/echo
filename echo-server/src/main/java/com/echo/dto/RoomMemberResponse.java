package com.echo.dto;

import com.echo.domain.AuthProvider;

/**
 * 채팅방 참여자 요약 DTO.
 */
public record RoomMemberResponse(
	Long userId,
	String displayName,
	String email,
	AuthProvider provider
) {
}
