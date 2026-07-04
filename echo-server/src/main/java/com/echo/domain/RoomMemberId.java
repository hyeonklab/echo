package com.echo.domain;

import java.io.Serializable;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * room_members 복합 키.
 */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RoomMemberId implements Serializable {

	private static final long serialVersionUID = 1L;

	@Column(name = "room_id")
	private Long roomId;

	@Column(name = "user_id")
	private Long userId;

	public RoomMemberId(Long roomId, Long userId) {
		this.roomId = roomId;
		this.userId = userId;
	}

}
