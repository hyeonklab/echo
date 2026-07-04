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
	List<RoomMemberResponse> members,
	LastMessagePreview lastMessage
) {

	/**
	 * Room 엔티티와 멤버 목록을 요청 사용자 기준 응답 DTO로 변환한다.
	 */
	public static RoomResponse from(
		Room room,
		List<RoomMember> members,
		Long viewerUserId,
		LastMessagePreview lastMessage
	) {
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
			resolveDisplayName(room, members, viewerUserId),
			room.getType(),
			room.getCreatedBy().getId(),
			room.getCreatedAt(),
			memberResponses,
			lastMessage
		);
	}

	private static String resolveDisplayName(Room room, List<RoomMember> members, Long viewerUserId) {
		if (room.getType() != RoomType.DM) {
			return room.getName();
		}

		return members.stream()
			.filter(member -> !member.getUser().getId().equals(viewerUserId))
			.findFirst()
			.map(member -> member.getUser().getDisplayName())
			.orElse(room.getName());
	}

}
