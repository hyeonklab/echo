package com.echo.dto;

import java.time.Instant;

import com.echo.domain.Message;

/**
 * 채팅방 목록용 마지막 메시지 미리보기 DTO.
 */
public record LastMessagePreview(
	Long senderId,
	String senderDisplayName,
	String content,
	Instant createdAt
) {

	/**
	 * Message 엔티티를 미리보기 DTO로 변환한다.
	 */
	public static LastMessagePreview from(Message message) {
		return new LastMessagePreview(
			message.getSender().getId(),
			message.getSender().getDisplayName(),
			message.getContent(),
			message.getCreatedAt()
		);
	}

}
