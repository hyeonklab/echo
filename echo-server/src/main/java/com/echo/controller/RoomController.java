package com.echo.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.echo.dto.CreateDmRoomRequest;
import com.echo.dto.CreateGroupRoomRequest;
import com.echo.dto.InviteRoomMemberRequest;
import com.echo.dto.RoomResponse;
import com.echo.security.UserPrincipal;
import com.echo.service.RoomService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 채팅방 REST API.
 */
@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

	private final RoomService roomService;

	/**
	 * 내 채팅방 목록을 반환한다.
	 */
	@GetMapping
	public List<RoomResponse> getRooms(@AuthenticationPrincipal UserPrincipal principal) {
		return roomService.getRoomsForUser(requireUserId(principal));
	}

	/**
	 * 채팅방 상세 정보를 반환한다.
	 */
	@GetMapping("/{roomId}")
	public RoomResponse getRoom(
		@AuthenticationPrincipal UserPrincipal principal,
		@PathVariable Long roomId
	) {
		return executeRoomAction(() -> roomService.getRoom(roomId, requireUserId(principal)));
	}

	/**
	 * 그룹 채팅방을 생성한다.
	 */
	@PostMapping
	public RoomResponse createGroupRoom(
		@AuthenticationPrincipal UserPrincipal principal,
		@Valid @RequestBody CreateGroupRoomRequest request
	) {
		return executeRoomAction(() -> roomService.createGroupRoom(requireUserId(principal), request));
	}

	/**
	 * 1:1 DM 채팅방을 조회하거나 생성한다.
	 */
	@PostMapping("/dm")
	public RoomResponse createDmRoom(
		@AuthenticationPrincipal UserPrincipal principal,
		@Valid @RequestBody CreateDmRoomRequest request
	) {
		return executeRoomAction(() -> roomService.createOrGetDmRoom(requireUserId(principal), request));
	}

	/**
	 * 채팅방에 멤버를 초대한다.
	 */
	@PostMapping("/{roomId}/members")
	public RoomResponse inviteMember(
		@AuthenticationPrincipal UserPrincipal principal,
		@PathVariable Long roomId,
		@Valid @RequestBody InviteRoomMemberRequest request
	) {
		return executeRoomAction(() -> roomService.inviteMember(roomId, requireUserId(principal), request));
	}

	/**
	 * 채팅방을 삭제하거나 참여를 종료한다.
	 */
	@DeleteMapping("/{roomId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteRoom(
		@AuthenticationPrincipal UserPrincipal principal,
		@PathVariable Long roomId
	) {
		executeRoomVoidAction(() -> roomService.deleteRoom(roomId, requireUserId(principal)));
	}

	private Long requireUserId(UserPrincipal principal) {
		if (principal == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
		}

		return principal.getUserId();
	}

	private RoomResponse executeRoomAction(java.util.function.Supplier<RoomResponse> action) {
		try {
			return action.get();
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
		}
	}

	private void executeRoomVoidAction(Runnable action) {
		try {
			action.run();
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
		}
	}

}
