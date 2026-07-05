package com.echo.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.echo.dto.RoomMetaUpdateResponse;
import com.echo.domain.Room;

import lombok.RequiredArgsConstructor;

/**
 * 채팅방 메타 정보 STOMP 브로드캐스트.
 */
@Service
@RequiredArgsConstructor
public class RoomBroadcastService {

	private final SimpMessagingTemplate messagingTemplate;

	/**
	 * 채팅방 구독자에게 메타 정보 변경을 전송한다.
	 */
	public void broadcastRoomMetaUpdate(Room room) {
		String destination = "/topic/rooms/" + room.getId() + "/meta";
		RoomMetaUpdateResponse update = RoomMetaUpdateResponse.from(room);

		messagingTemplate.convertAndSend(destination, update);
	}

}
