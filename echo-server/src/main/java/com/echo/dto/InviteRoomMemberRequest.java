package com.echo.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 채팅방 멤버 초대 요청 DTO.
 */
public record InviteRoomMemberRequest(
	@NotNull
	Long userId
) {
}
