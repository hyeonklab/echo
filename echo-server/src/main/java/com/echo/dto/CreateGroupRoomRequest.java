package com.echo.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;

/**
 * 그룹 채팅방 생성 요청 DTO.
 */
public record CreateGroupRoomRequest(
	@NotBlank
	String name,
	List<Long> memberUserIds
) {
}
