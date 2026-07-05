package com.echo.dto;

/**
 * 메시지 삭제 브로드캐스트 DTO.
 */
public record MessageDeletedResponse(
	Long roomId,
	Long messageId
) {

}
