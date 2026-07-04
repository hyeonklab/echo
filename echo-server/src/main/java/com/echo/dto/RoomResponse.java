package com.echo.dto;

import java.time.Instant;
import java.util.List;

import com.echo.domain.Room;
import com.echo.domain.RoomMember;
import com.echo.domain.RoomType;

/**
 * 채팅방 응답 DTO.
 */
public record RoomResponse(
	Long id,
	String name,
	RoomType type,
	Long createdByUserId,
	Instant createdAt,
	List<RoomMemberResponse> members
) {

	/**
	 * Room 엔티티와 멤버 목록을 응답 DTO로 변환한다.
	 */
	public static RoomResponse from(Room room, List<RoomMember> members) {
		List<RoomMemberResponse> memberResponses = members.stream()
			.map(member -> new RoomMemberResponse(
				member.getUser().getId(),
				member.getUser().getDisplayName(),
				member.getUser().getEmail(),
				member.getUser().getProvider()
			))
			.toList();

		return new RoomResponse(
			room.getId(),
			room.getName(),
			room.getType(),
			room.getCreatedBy().getId(),
			room.getCreatedAt(),
			memberResponses
		);
	}

}
