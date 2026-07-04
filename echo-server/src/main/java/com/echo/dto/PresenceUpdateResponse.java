package com.echo.dto;

/**
 * 사용자 온라인 상태 변경 브로드캐스트 DTO.
 */
public record PresenceUpdateResponse(
	Long userId,
	boolean online
) {
}
