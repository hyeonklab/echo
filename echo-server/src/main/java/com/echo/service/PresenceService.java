package com.echo.service;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.echo.dto.PresenceUpdateResponse;

import lombok.RequiredArgsConstructor;

/**
 * WebSocket 세션 기반 온라인 상태 관리.
 */
@Service
@RequiredArgsConstructor
public class PresenceService {

	private final PresenceBroadcastService presenceBroadcastService;
	private final ConcurrentHashMap<Long, Set<String>> userSessions = new ConcurrentHashMap<>();

	/**
	 * 사용자 WebSocket 세션 연결을 등록한다.
	 */
	public void userConnected(Long userId, String sessionId) {
		Set<String> sessions = userSessions.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet());
		boolean wasOffline = sessions.isEmpty();

		sessions.add(sessionId);

		if (wasOffline) {
			presenceBroadcastService.broadcastPresence(new PresenceUpdateResponse(userId, true));
		}
	}

	/**
	 * 사용자 WebSocket 세션 연결 해제를 처리한다.
	 */
	public void userDisconnected(Long userId, String sessionId) {
		Set<String> sessions = userSessions.get(userId);

		if (sessions == null) {
			return;
		}

		sessions.remove(sessionId);

		if (sessions.isEmpty()) {
			userSessions.remove(userId);
			presenceBroadcastService.broadcastPresence(new PresenceUpdateResponse(userId, false));
		}
	}

	/**
	 * 사용자 온라인 여부를 반환한다.
	 */
	public boolean isOnline(Long userId) {
		return userSessions.containsKey(userId);
	}

	/**
	 * 현재 온라인 사용자 ID 목록을 반환한다.
	 */
	public Set<Long> getOnlineUserIds() {
		return Collections.unmodifiableSet(userSessions.keySet());
	}

}
