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
import com.echo.domain.MessageHidden;
import com.echo.domain.Room;
import com.echo.domain.User;
import com.echo.dto.MessageDeletedResponse;
import com.echo.dto.MessageHistoryResponse;
import com.echo.dto.MessageResponse;
import com.echo.dto.MemberReadStateResponse;
import com.echo.dto.SendMessageRequest;
import com.echo.repository.MessageHiddenRepository;
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
	private final MessageHiddenRepository messageHiddenRepository;
	private final RoomRepository roomRepository;
	private final RoomMemberRepository roomMemberRepository;
	private final UserService userService;
	private final MessageBroadcastService messageBroadcastService;
	private final RoomReadStateService roomReadStateService;

	/**
	 * 채팅방 메시지 히스토리를 반환한다.
	 */
	@Transactional(readOnly = true)
	public MessageHistoryResponse getMessages(Long roomId, Long userId, Long beforeId, Integer limit) {
		verifyRoomMember(roomId, userId);

		int pageSize = normalizeLimit(limit);
		Pageable pageable = PageRequest.of(0, pageSize + 1);
		List<Message> messages = beforeId == null
			? messageRepository.findVisibleByRoom_IdOrderByCreatedAtDesc(roomId, userId, pageable)
			: messageRepository.findVisibleByRoom_IdAndIdLessThanOrderByCreatedAtDesc(roomId, beforeId, userId, pageable);

		boolean hasMore = messages.size() > pageSize;

		if (hasMore) {
			messages = new ArrayList<>(messages.subList(0, pageSize));
		}

		List<Message> ascendingMessages = new ArrayList<>(messages);
		Collections.reverse(ascendingMessages);

		List<MessageResponse> responses = ascendingMessages.stream()
			.map(MessageResponse::from)
			.toList();

		Long peerLastReadMessageId = roomReadStateService.getPeerLastReadMessageId(roomId, userId);
		List<MemberReadStateResponse> memberReadStates = roomReadStateService.getMemberReadStates(roomId, userId);

		return new MessageHistoryResponse(responses, hasMore, peerLastReadMessageId, memberReadStates);
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

		roomReadStateService.markAsRead(roomId, userId, message.getId());
		messageBroadcastService.broadcastMessage(response);

		return response;
	}

	/**
	 * 메시지를 현재 사용자 화면에서만 숨긴다.
	 */
	@Transactional
	public void hideMessageForUser(Long roomId, Long userId, Long messageId) {
		verifyRoomMember(roomId, userId);

		Message message = getMessageInRoom(roomId, messageId);

		if (messageHiddenRepository.existsById_UserIdAndId_MessageId(userId, messageId)) {
			return;
		}

		User user = userService.getUser(userId);
		MessageHidden hidden = MessageHidden.builder()
			.user(user)
			.message(message)
			.build();

		messageHiddenRepository.save(Objects.requireNonNull(hidden));
	}

	/**
	 * 메시지를 모든 참여자에게서 삭제한다.
	 */
	@Transactional
	public void deleteMessageForEveryone(Long roomId, Long userId, Long messageId) {
		verifyRoomMember(roomId, userId);

		Message message = getMessageInRoom(roomId, messageId);

		if (!message.getSender().getId().equals(userId)) {
			throw new IllegalArgumentException("Only the sender can delete a message for everyone");
		}

		messageRepository.delete(message);
		messageBroadcastService.broadcastMessageDeleted(new MessageDeletedResponse(roomId, messageId));
	}

	private Message getMessageInRoom(Long roomId, Long messageId) {
		Message message = messageRepository.findById(Objects.requireNonNull(messageId))
			.orElseThrow(() -> new IllegalArgumentException("Message not found"));

		if (!message.getRoom().getId().equals(roomId)) {
			throw new IllegalArgumentException("Message does not belong to this room");
		}

		return message;
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
