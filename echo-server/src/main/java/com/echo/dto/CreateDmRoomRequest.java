package com.echo.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 1:1 DM 채팅방 생성 요청 DTO.
 */
public record CreateDmRoomRequest(
	@NotNull
	Long targetUserId
) {
}
