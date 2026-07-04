package com.echo.dto;

import java.time.Instant;

import com.echo.domain.Friend;

/**
 * 친구 목록 응답 DTO.
 */
public record FriendResponse(
	Long id,
	String email,
	String displayName,
	String provider,
	Instant addedAt,
	boolean online
) {

	/**
	 * Friend 엔티티를 응답 DTO로 변환한다.
	 */
	public static FriendResponse from(Friend friend, boolean online) {
		return new FriendResponse(
			friend.getFriend().getId(),
			friend.getFriend().getEmail(),
			friend.getFriend().getDisplayName(),
			friend.getFriend().getProvider().name(),
			friend.getCreatedAt(),
			online
		);
	}

}
