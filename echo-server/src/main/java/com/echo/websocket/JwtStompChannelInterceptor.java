package com.echo.websocket;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.echo.domain.User;
import com.echo.repository.RoomMemberRepository;
import com.echo.repository.UserRepository;
import com.echo.security.JwtTokenProvider;
import com.echo.security.UserPrincipal;

import lombok.RequiredArgsConstructor;

/**
 * STOMP CONNECT/SUBSCRIBE 요청에 JWT 인증 및 채팅방 구독 권한을 검증한다.
 */
@Component
@RequiredArgsConstructor
public class JwtStompChannelInterceptor implements ChannelInterceptor {

	private static final String AUTHORIZATION_HEADER = "Authorization";
	private static final String BEARER_PREFIX = "Bearer ";
	private static final Pattern ROOM_TOPIC_PATTERN = Pattern.compile("^/topic/rooms/(\\d+)/messages$");

	private final JwtTokenProvider jwtTokenProvider;
	private final UserRepository userRepository;
	private final RoomMemberRepository roomMemberRepository;

	@Override
	public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
		StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

		if (accessor == null) {
			return message;
		}

		if (StompCommand.CONNECT.equals(accessor.getCommand())) {
			authenticateConnect(accessor);
			return message;
		}

		if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
			authorizeSubscribe(accessor);
		}

		return message;
	}

	private void authenticateConnect(StompHeaderAccessor accessor) {
		String token = resolveBearerToken(accessor);

		if (token == null || !jwtTokenProvider.validateAccessToken(token)) {
			throw new IllegalArgumentException("Invalid access token");
		}

		Long userId = jwtTokenProvider.getUserId(token);
		User user = userRepository.findById(userId)
			.orElseThrow(() -> new IllegalArgumentException("User not found"));

		UserPrincipal principal = new UserPrincipal(user);
		Authentication authentication = new UsernamePasswordAuthenticationToken(
			principal,
			null,
			principal.getAuthorities()
		);

		accessor.setUser(authentication);
	}

	private void authorizeSubscribe(StompHeaderAccessor accessor) {
		UserPrincipal principal = resolvePrincipal(accessor);

		if (principal == null) {
			throw new AccessDeniedException("Authentication required");
		}

		Long roomId = parseRoomTopicRoomId(accessor.getDestination());

		if (roomId == null) {
			return;
		}

		if (!roomMemberRepository.existsByRoom_IdAndUser_Id(roomId, principal.getUserId())) {
			throw new AccessDeniedException("Room access denied");
		}
	}

	@Nullable
	private UserPrincipal resolvePrincipal(StompHeaderAccessor accessor) {
		if (accessor.getUser() instanceof Authentication authentication
			&& authentication.getPrincipal() instanceof UserPrincipal principal) {
			return principal;
		}

		return null;
	}

	@Nullable
	private Long parseRoomTopicRoomId(@Nullable String destination) {
		if (destination == null) {
			return null;
		}

		Matcher matcher = ROOM_TOPIC_PATTERN.matcher(destination);

		if (!matcher.matches()) {
			return null;
		}

		return Long.parseLong(matcher.group(1));
	}

	@Nullable
	private String resolveBearerToken(StompHeaderAccessor accessor) {
		String authorization = accessor.getFirstNativeHeader(AUTHORIZATION_HEADER);

		if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
			return null;
		}

		return authorization.substring(BEARER_PREFIX.length()).trim();
	}

}
