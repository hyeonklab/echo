package com.echo.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.echo.domain.Message;
import com.echo.domain.Room;
import com.echo.domain.User;
import com.echo.dto.MessageHistoryResponse;
import com.echo.dto.MessageResponse;
import com.echo.dto.SendMessageRequest;
import com.echo.repository.MessageRepository;
import com.echo.repository.RoomMemberRepository;
import com.echo.repository.RoomRepository;

import lombok.RequiredArgsConstructor;

/**
 * 메시지 전송 및 히스토리 조회.
 */
@Service
@RequiredArgsConstructor
public class MessageService {

	private static final int DEFAULT_LIMIT = 50;
	private static final int MAX_LIMIT = 100;

	private final MessageRepository messageRepository;
	private final RoomRepository roomRepository;
	private final RoomMemberRepository roomMemberRepository;
	private final UserService userService;
	private final MessageBroadcastService messageBroadcastService;

	/**
	 * 채팅방 메시지 히스토리를 반환한다.
	 */
	@Transactional(readOnly = true)
	public MessageHistoryResponse getMessages(Long roomId, Long userId, Long beforeId, Integer limit) {
		verifyRoomMember(roomId, userId);

		int pageSize = normalizeLimit(limit);
		Pageable pageable = PageRequest.of(0, pageSize + 1);
		List<Message> messages = beforeId == null
			? messageRepository.findByRoom_IdOrderByCreatedAtDesc(roomId, pageable)
			: messageRepository.findByRoom_IdAndIdLessThanOrderByCreatedAtDesc(roomId, beforeId, pageable);

		boolean hasMore = messages.size() > pageSize;

		if (hasMore) {
			messages = new ArrayList<>(messages.subList(0, pageSize));
		}

		List<Message> ascendingMessages = new ArrayList<>(messages);
		Collections.reverse(ascendingMessages);

		List<MessageResponse> responses = ascendingMessages.stream()
			.map(MessageResponse::from)
			.toList();

		return new MessageHistoryResponse(responses, hasMore);
	}

	/**
	 * 채팅방에 메시지를 전송한다.
	 */
	@Transactional
	public MessageResponse sendMessage(Long roomId, Long userId, SendMessageRequest request) {
		Room room = verifyRoomMember(roomId, userId);
		User sender = userService.getUser(userId);
		Message newMessage = Message.builder()
			.room(room)
			.sender(sender)
			.content(request.content().trim())
			.build();
		Message message = messageRepository.save(Objects.requireNonNull(newMessage));
		MessageResponse response = MessageResponse.from(message);

		messageBroadcastService.broadcastMessage(response);

		return response;
	}

	private Room verifyRoomMember(Long roomId, Long userId) {
		if (!roomMemberRepository.existsByRoom_IdAndUser_Id(roomId, userId)) {
			throw new IllegalArgumentException("Room not found or access denied");
		}

		return roomRepository.findById(Objects.requireNonNull(roomId))
			.orElseThrow(() -> new IllegalArgumentException("Room not found or access denied"));
	}

	private int normalizeLimit(Integer limit) {
		if (limit == null || limit <= 0) {
			return DEFAULT_LIMIT;
		}

		return Math.min(limit, MAX_LIMIT);
	}

}
