package com.echo.service;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.echo.domain.Room;
import com.echo.domain.RoomMember;
import com.echo.domain.RoomType;
import com.echo.domain.User;
import com.echo.dto.CreateDmRoomRequest;
import com.echo.dto.CreateGroupRoomRequest;
import com.echo.dto.InviteRoomMemberRequest;
import com.echo.dto.RoomResponse;
import com.echo.repository.RoomMemberRepository;
import com.echo.repository.RoomRepository;

import lombok.RequiredArgsConstructor;

/**
 * 채팅방 생성·조회·초대·삭제 처리.
 */
@Service
@RequiredArgsConstructor
public class RoomService {

	private final RoomRepository roomRepository;
	private final RoomMemberRepository roomMemberRepository;
	private final UserService userService;

	/**
	 * 사용자가 참여 중인 채팅방 목록을 반환한다.
	 */
	@Transactional(readOnly = true)
	public List<RoomResponse> getRoomsForUser(Long userId) {
		return roomRepository.findAllByMemberUserId(userId).stream()
			.map(room -> toRoomResponse(room))
			.toList();
	}

	/**
	 * 채팅방 상세 정보를 반환한다.
	 */
	@Transactional(readOnly = true)
	public RoomResponse getRoom(Long roomId, Long userId) {
		Room room = getRoomForMember(roomId, userId);

		return toRoomResponse(room);
	}

	/**
	 * 그룹 채팅방을 생성한다.
	 */
	@Transactional
	public RoomResponse createGroupRoom(Long userId, CreateGroupRoomRequest request) {
		User creator = userService.getUser(userId);
		Room newRoom = Room.builder()
			.name(request.name().trim())
			.type(RoomType.GROUP)
			.createdBy(creator)
			.build();
		Room room = roomRepository.save(Objects.requireNonNull(newRoom));

		addMember(room, creator);

		if (request.memberUserIds() != null) {
			for (Long memberUserId : new HashSet<>(request.memberUserIds())) {
				if (memberUserId.equals(userId)) {
					continue;
				}

				User member = userService.getUser(memberUserId);
				addMember(room, member);
			}
		}

		return toRoomResponse(room);
	}

	/**
	 * 1:1 DM 채팅방을 조회하거나 생성한다.
	 */
	@Transactional
	public RoomResponse createOrGetDmRoom(Long userId, CreateDmRoomRequest request) {
		if (userId.equals(request.targetUserId())) {
			throw new IllegalArgumentException("Cannot create DM room with yourself");
		}

		User currentUser = userService.getUser(userId);
		User targetUser = userService.getUser(request.targetUserId());

		List<Room> existingRooms = roomRepository.findDmRoomsBetween(userId, request.targetUserId(), RoomType.DM);

		if (!existingRooms.isEmpty()) {
			return toRoomResponse(existingRooms.get(0));
		}

		Room newRoom = Room.builder()
			.name(targetUser.getDisplayName())
			.type(RoomType.DM)
			.createdBy(currentUser)
			.build();
		Room room = roomRepository.save(Objects.requireNonNull(newRoom));

		addMember(room, currentUser);
		addMember(room, targetUser);

		return toRoomResponse(room);
	}

	/**
	 * 채팅방에 멤버를 초대한다.
	 */
	@Transactional
	public RoomResponse inviteMember(Long roomId, Long requesterUserId, InviteRoomMemberRequest request) {
		Room room = getRoomForMember(roomId, requesterUserId);

		if (room.getType() == RoomType.DM) {
			throw new IllegalArgumentException("Cannot invite members to a DM room");
		}

		if (roomMemberRepository.existsByRoom_IdAndUser_Id(roomId, request.userId())) {
			throw new IllegalArgumentException("User is already a member of this room");
		}

		User member = userService.getUser(request.userId());
		addMember(room, member);

		return toRoomResponse(room);
	}

	/**
	 * 채팅방을 삭제하거나 참여를 종료한다.
	 */
	@Transactional
	public void deleteRoom(Long roomId, Long userId) {
		Room room = getRoomForMember(roomId, userId);

		if (room.getCreatedBy().getId().equals(userId)) {
			roomRepository.delete(room);
			return;
		}

		roomMemberRepository.deleteByRoom_IdAndUser_Id(roomId, userId);

		if (room.getType() == RoomType.DM || roomMemberRepository.countByRoom_Id(roomId) == 0) {
			roomRepository.delete(room);
		}
	}

	private Room getRoomForMember(Long roomId, Long userId) {
		if (!roomMemberRepository.existsByRoom_IdAndUser_Id(roomId, userId)) {
			throw new IllegalArgumentException("Room not found or access denied");
		}

		return roomRepository.findById(Objects.requireNonNull(roomId))
			.orElseThrow(() -> new IllegalArgumentException("Room not found or access denied"));
	}

	private void addMember(Room room, User user) {
		if (roomMemberRepository.existsByRoom_IdAndUser_Id(room.getId(), user.getId())) {
			return;
		}

		RoomMember newMember = RoomMember.builder()
			.room(room)
			.user(user)
			.build();
		roomMemberRepository.save(Objects.requireNonNull(newMember));
	}

	private RoomResponse toRoomResponse(Room room) {
		List<RoomMember> members = roomMemberRepository.findAllByRoom_IdOrderByJoinedAtAsc(room.getId());

		return RoomResponse.from(room, members);
	}

}
