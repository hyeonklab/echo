package com.echo.service;

import java.util.List;
import java.util.Objects;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.echo.domain.Friend;
import com.echo.domain.User;
import com.echo.dto.FriendResponse;
import com.echo.repository.FriendRepository;

import lombok.RequiredArgsConstructor;

/**
 * 친구 목록 관리.
 */
@Service
@RequiredArgsConstructor
public class FriendService {

	private final FriendRepository friendRepository;
	private final UserService userService;
	private final PresenceService presenceService;

	/**
	 * 내 친구 목록을 반환한다.
	 */
	@Transactional(readOnly = true)
	public List<FriendResponse> getFriends(Long ownerUserId) {
		return friendRepository.findByOwnerIdOrderByCreatedAtDesc(ownerUserId).stream()
			.map(friend -> FriendResponse.from(friend, presenceService.isOnline(friend.getFriend().getId())))
			.toList();
	}

	/**
	 * 친구를 추가한다.
	 */
	@Transactional
	public FriendResponse addFriend(Long ownerUserId, Long targetUserId) {
		if (Objects.equals(ownerUserId, targetUserId)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add yourself as a friend");
		}

		if (friendRepository.existsByOwnerIdAndFriendId(ownerUserId, targetUserId)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "Friend already exists");
		}

		User owner = userService.getUser(ownerUserId);
		User friend = userService.getUser(targetUserId);
		Friend savedFriend = friendRepository.save(
			Friend.builder()
				.owner(owner)
				.friend(friend)
				.build()
		);

		return FriendResponse.from(savedFriend, presenceService.isOnline(targetUserId));
	}

	/**
	 * 친구를 삭제한다.
	 */
	@Transactional
	public void removeFriend(Long ownerUserId, Long friendUserId) {
		Friend friend = friendRepository.findByOwnerIdAndFriendId(ownerUserId, friendUserId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Friend not found"));

		friendRepository.delete(Objects.requireNonNull(friend));
	}

}
