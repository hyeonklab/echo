package com.echo.service;

import org.springframework.lang.NonNull;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.echo.dto.PresenceUpdateResponse;

import lombok.RequiredArgsConstructor;

/**
 * 사용자 온라인 상태 STOMP 브로드캐스트.
 */
@Service
@RequiredArgsConstructor
public class PresenceBroadcastService {

	private static final String PRESENCE_TOPIC = "/topic/presence";

	private final SimpMessagingTemplate messagingTemplate;

	/**
	 * 온라인 상태 변경을 전체 구독자에게 전송한다.
	 */
	public void broadcastPresence(@NonNull PresenceUpdateResponse update) {
		messagingTemplate.convertAndSend(PRESENCE_TOPIC, update);
	}

}
