package com.echo.service;

import java.util.List;
import java.util.Objects;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.echo.domain.AuthProvider;
import com.echo.domain.User;
import com.echo.dto.UserResponse;
import com.echo.repository.UserRepository;
import com.echo.util.AttributeUtils;

import lombok.RequiredArgsConstructor;

/**
 * 사용자 생성 및 OAuth 프로필 동기화.
 */
@Service
@RequiredArgsConstructor
public class UserService {

	private static final int MIN_SEARCH_KEYWORD_LENGTH = 2;
	private static final int MAX_SEARCH_RESULTS = 20;

	private final UserRepository userRepository;

	/**
	 * OAuth 로그인 사용자를 조회하거나 생성한다.
	 */
	@Transactional
	public User upsertOAuthUser(String registrationId, OAuth2User oauth2User) {
		AuthProvider provider = AuthProvider.fromRegistrationId(registrationId);
		String providerId = resolveProviderId(provider, oauth2User);
		String email = resolveEmail(oauth2User);
		String displayName = resolveDisplayName(oauth2User);

		return userRepository.findByProviderAndProviderId(provider, providerId)
			.map(existing -> updateOAuthProfile(existing, email, displayName))
			.orElseGet(() -> createOAuthUser(provider, providerId, email, displayName));
	}

	/**
	 * ID로 사용자를 조회한다.
	 */
	@Transactional(readOnly = true)
	public User getUser(Long userId) {
		return userRepository.findById(Objects.requireNonNull(userId))
			.orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
	}

	/**
	 * 이름 또는 이메일로 사용자를 검색한다.
	 */
	@Transactional(readOnly = true)
	public List<UserResponse> searchUsers(String keyword, Long excludeUserId) {
		if (keyword == null || keyword.trim().length() < MIN_SEARCH_KEYWORD_LENGTH) {
			return List.of();
		}

		String trimmedKeyword = keyword.trim();
		Pageable pageable = PageRequest.of(0, MAX_SEARCH_RESULTS);

		return userRepository.searchUsers(trimmedKeyword, excludeUserId, pageable).stream()
			.map(UserResponse::from)
			.toList();
	}

	private User updateOAuthProfile(User user, String email, String displayName) {
		user.updateOAuthProfile(email, displayName);

		return user;
	}

	private User createOAuthUser(AuthProvider provider, String providerId, String email, String displayName) {
		User user = User.builder()
			.email(email)
			.displayName(displayName)
			.provider(provider)
			.providerId(providerId)
			.build();

		return userRepository.save(user);
	}

	private String resolveProviderId(AuthProvider provider, OAuth2User oauth2User) {
		String providerId = switch (provider) {
			case GOOGLE -> AttributeUtils.stringValue(oauth2User.getAttribute("sub"));
			case NAVER -> AttributeUtils.stringValue(oauth2User.getAttribute("id"));
			default -> null;
		};

		if (providerId == null || providerId.isBlank()) {
			throw new IllegalArgumentException("OAuth provider id is missing");
		}

		return providerId;
	}

	private String resolveEmail(OAuth2User oauth2User) {
		return AttributeUtils.stringValue(oauth2User.getAttribute("email"));
	}

	private String resolveDisplayName(OAuth2User oauth2User) {
		String displayName = AttributeUtils.stringValue(oauth2User.getAttribute("name"));

		if (displayName == null || displayName.isBlank()) {
			displayName = AttributeUtils.stringValue(oauth2User.getAttribute("nickname"));
		}

		if (displayName == null || displayName.isBlank()) {
			displayName = "Echo User";
		}

		return displayName;
	}

}
