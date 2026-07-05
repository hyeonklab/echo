package com.echo.dto;

import com.echo.domain.Room;

/**
 * 채팅방 메타 정보 변경 STOMP 응답 DTO.
 */
public record RoomMetaUpdateResponse(
	Long roomId,
	String name
) {

	/**
	 * Room 엔티티를 메타 변경 응답 DTO로 변환한다.
	 */
	public static RoomMetaUpdateResponse from(Room room) {
		return new RoomMetaUpdateResponse(room.getId(), room.getName());
	}

}
