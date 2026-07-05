package com.echo.service;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.echo.domain.Message;
import com.echo.domain.Room;
import com.echo.domain.RoomMember;
import com.echo.domain.RoomReadState;
import com.echo.domain.User;
import com.echo.dto.MemberReadStateResponse;
import com.echo.dto.RoomReadResponse;
import com.echo.repository.MessageRepository;
import com.echo.repository.RoomMemberRepository;
import com.echo.repository.RoomReadStateRepository;
import com.echo.repository.RoomRepository;

import lombok.RequiredArgsConstructor;

/**
 * 채팅방 읽음 상태 처리.
 */
@Service
@RequiredArgsConstructor
public class RoomReadStateService {

	private final RoomReadStateRepository roomReadStateRepository;
	private final RoomMemberRepository roomMemberRepository;
	private final RoomRepository roomRepository;
	private final MessageRepository messageRepository;
	private final UserService userService;
	private final ReadBroadcastService readBroadcastService;

	/**
	 * 채팅방 메시지를 읽음 처리한다.
	 */
	@Transactional
	public RoomReadResponse markAsRead(Long roomId, Long userId, Long messageId) {
		verifyRoomMember(roomId, userId);

		Message message = messageRepository.findById(Objects.requireNonNull(messageId))
			.orElseThrow(() -> new IllegalArgumentException("Message not found"));

		if (!message.getRoom().getId().equals(roomId)) {
			throw new IllegalArgumentException("Message does not belong to this room");
		}

		Room room = roomRepository.findById(Objects.requireNonNull(roomId))
			.orElseThrow(() -> new IllegalArgumentException("Room not found or access denied"));
		User user = userService.getUser(userId);

		RoomReadState readState = roomReadStateRepository.findById_RoomIdAndId_UserId(roomId, userId)
			.orElseGet(() -> RoomReadState.builder()
				.room(room)
				.user(user)
				.lastReadMessageId(null)
				.build());

		readState.updateLastReadMessageId(messageId);
		roomReadStateRepository.save(readState);

		RoomReadResponse response = new RoomReadResponse(roomId, userId, readState.getLastReadMessageId());
		readBroadcastService.broadcastRoomRead(response);

		return response;
	}

	/**
	 * 채팅방의 읽지 않은 메시지 수를 반환한다.
	 */
	@Transactional(readOnly = true)
	public int countUnread(Long roomId, Long userId) {
		verifyRoomMember(roomId, userId);

		long afterMessageId = getLastReadMessageId(roomId, userId).orElse(0L);

		return Math.toIntExact(messageRepository.countUnreadAfter(roomId, userId, afterMessageId));
	}

	/**
	 * 여러 채팅방의 읽지 않은 메시지 수를 반환한다.
	 */
	@Transactional(readOnly = true)
	public Map<Long, Integer> countUnreadByRoomIds(Long userId, Collection<Long> roomIds) {
		if (roomIds.isEmpty()) {
			return Map.of();
		}

		Map<Long, Integer> unreadCounts = new HashMap<>();

		for (Object[] row : messageRepository.countUnreadByRoomIds(userId, roomIds)) {
			Long roomId = ((Number) row[0]).longValue();
			int count = ((Number) row[1]).intValue();

			unreadCounts.put(roomId, count);
		}

		return unreadCounts;
	}

	/**
	 * 채팅방 멤버별 읽음 상태를 반환한다.
	 */
	@Transactional(readOnly = true)
	public List<MemberReadStateResponse> getMemberReadStates(Long roomId, Long userId) {
		verifyRoomMember(roomId, userId);

		List<RoomMember> members = roomMemberRepository.findAllByRoom_IdOrderByJoinedAtAsc(roomId);

		return members.stream()
			.map(member -> new MemberReadStateResponse(
				member.getUser().getId(),
				getLastReadMessageId(roomId, member.getUser().getId()).orElse(null)
			))
			.toList();
	}

	/**
	 * 상대방의 마지막 읽은 메시지 ID를 반환한다.
	 */
	@Transactional(readOnly = true)
	public Long getPeerLastReadMessageId(Long roomId, Long userId) {
		verifyRoomMember(roomId, userId);

		List<RoomMember> members = roomMemberRepository.findAllByRoom_IdOrderByJoinedAtAsc(roomId);

		for (RoomMember member : members) {
			if (member.getUser().getId().equals(userId)) {
				continue;
			}

			return getLastReadMessageId(roomId, member.getUser().getId()).orElse(null);
		}

		return null;
	}

	private java.util.Optional<Long> getLastReadMessageId(Long roomId, Long userId) {
		return roomReadStateRepository.findById_RoomIdAndId_UserId(roomId, userId)
			.map(readState -> readState.getLastReadMessageId());
	}

	private void verifyRoomMember(Long roomId, Long userId) {
		if (!roomMemberRepository.existsByRoom_IdAndUser_Id(roomId, userId)) {
			throw new IllegalArgumentException("Room not found or access denied");
		}

		roomRepository.findById(Objects.requireNonNull(roomId))
			.orElseThrow(() -> new IllegalArgumentException("Room not found or access denied"));
	}

}
