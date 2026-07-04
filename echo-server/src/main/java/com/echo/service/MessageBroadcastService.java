package com.echo.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.echo.dto.MessageResponse;

import lombok.RequiredArgsConstructor;

/**
 * 채팅방 메시지 STOMP 브로드캐스트.
 */
@Service
@RequiredArgsConstructor
public class MessageBroadcastService {

	private final SimpMessagingTemplate messagingTemplate;

	/**
	 * 채팅방 구독자에게 새 메시지를 전송한다.
	 */
	public void broadcastMessage(MessageResponse message) {
		String destination = "/topic/rooms/" + message.roomId() + "/messages";

		messagingTemplate.convertAndSend(destination, message);
	}

}
