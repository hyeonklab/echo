package com.echo.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 채팅방 이름 변경 요청 DTO.
 */
public record UpdateRoomNameRequest(
	@NotBlank
	String name
) {
}
