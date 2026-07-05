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
 * 사용자별 숨김 메시지 엔티티.
 */
@Entity
@Table(name = "message_hidden")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MessageHidden {

	@EmbeddedId
	private MessageHiddenId id = new MessageHiddenId();

	@MapsId("userId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@MapsId("messageId")
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "message_id", nullable = false)
	private Message message;

	@Column(name = "hidden_at", nullable = false, updatable = false)
	private Instant hiddenAt;

	@Builder
	public MessageHidden(User user, Message message) {
		this.user = user;
		this.message = message;
	}

	@PrePersist
	void onCreate() {
		if (hiddenAt == null) {
			hiddenAt = Instant.now();
		}
	}

}
