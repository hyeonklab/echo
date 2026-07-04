package com.echo.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 채팅방 참여자 엔티티.
 */
@Entity
@Table(name = "room_members")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RoomMember {

	@EmbeddedId
	private RoomMemberId id = new RoomMemberId();

	@MapsId("roomId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "room_id", nullable = false)
	private Room room;

	@MapsId("userId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "joined_at", nullable = false, updatable = false)
	private Instant joinedAt;

	@Builder
	public RoomMember(Room room, User user) {
		this.room = room;
		this.user = user;
	}

	@PrePersist
	void onCreate() {
		if (joinedAt == null) {
			joinedAt = Instant.now();
		}
	}

}
