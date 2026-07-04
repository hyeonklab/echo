package com.echo.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.echo.dto.UserResponse;
import com.echo.security.UserPrincipal;
import com.echo.service.UserService;

import lombok.RequiredArgsConstructor;

/**
 * 사용자 검색 REST API.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

	private final UserService userService;

	/**
	 * 이름 또는 이메일로 사용자를 검색한다.
	 */
	@GetMapping("/search")
	public List<UserResponse> searchUsers(
		@AuthenticationPrincipal UserPrincipal principal,
		@RequestParam(name = "q") String keyword
	) {
		return userService.searchUsers(keyword, requireUserId(principal));
	}

	private Long requireUserId(UserPrincipal principal) {
		if (principal == null) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
		}

		return principal.getUserId();
	}

}
