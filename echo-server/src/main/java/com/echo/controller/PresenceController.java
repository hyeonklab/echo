package com.echo.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.echo.security.UserPrincipal;
import com.echo.service.PresenceService;

import lombok.RequiredArgsConstructor;

/**
 * 사용자 온라인 상태 REST API.
 */
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

	private final PresenceService presenceService;

	/**
	 * 현재 온라인 사용자 ID 목록을 반환한다.
	 */
	@GetMapping("/online")
	public List<Long> getOnlineUsers(@AuthenticationPrincipal UserPrincipal principal) {
		requireUserId(principal);

		return presenceService.getOnlineUserIds().stream()
			.sorted()
			.toList();
	}

	private void requireUserId(UserPrincipal principal) {
		if (principal == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
		}
	}

}
