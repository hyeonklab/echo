package com.echo.websocket;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.echo.security.UserPrincipal;
import com.echo.service.PresenceService;

import lombok.RequiredArgsConstructor;

/**
 * WebSocket 세션 연결/해제 시 온라인 상태를 갱신한다.
 */
@Component
@RequiredArgsConstructor
public class PresenceEventListener {

	private final PresenceService presenceService;

	/**
	 * STOMP 연결 시 사용자를 온라인으로 표시한다.
	 */
	@EventListener
	public void handleSessionConnected(SessionConnectedEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		UserPrincipal principal = resolvePrincipal(accessor);
		String sessionId = accessor.getSessionId();

		if (principal == null || sessionId == null) {
			return;
		}

		presenceService.userConnected(principal.getUserId(), sessionId);
	}

	/**
	 * STOMP 연결 해제 시 사용자를 오프라인으로 표시한다.
	 */
	@EventListener
	public void handleSessionDisconnect(SessionDisconnectEvent event) {
		StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
		UserPrincipal principal = resolvePrincipal(accessor);
		String sessionId = accessor.getSessionId();

		if (principal == null || sessionId == null) {
			return;
		}

		presenceService.userDisconnected(principal.getUserId(), sessionId);
	}

	private UserPrincipal resolvePrincipal(StompHeaderAccessor accessor) {
		if (accessor.getUser() instanceof Authentication authentication
			&& authentication.getPrincipal() instanceof UserPrincipal principal) {
			return principal;
		}

		return null;
	}

}
