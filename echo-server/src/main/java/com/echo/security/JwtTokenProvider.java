package com.echo.security;

import java.time.Instant;

import javax.crypto.SecretKey;

import org.springframework.lang.NonNull;

import com.echo.domain.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;

/**
 * JWT access/refresh 토큰 생성 및 검증.
 */
public class JwtTokenProvider {

	private static final String TOKEN_TYPE_CLAIM = "type";
	private static final String ACCESS_TOKEN_TYPE = "access";
	private static final String REFRESH_TOKEN_TYPE = "refresh";

	private final SecretKey secretKey;
	private final long accessTokenExpirationMs;
	private final long refreshTokenExpirationMs;

	public JwtTokenProvider(SecretKey secretKey, long accessTokenExpirationMs, long refreshTokenExpirationMs) {
		this.secretKey = secretKey;
		this.accessTokenExpirationMs = accessTokenExpirationMs;
		this.refreshTokenExpirationMs = refreshTokenExpirationMs;
	}

	/**
	 * access token을 생성한다.
	 */
	public String createAccessToken(User user) {
		return createToken(user, accessTokenExpirationMs, ACCESS_TOKEN_TYPE);
	}

	/**
	 * refresh token을 생성한다.
	 */
	public String createRefreshToken(User user) {
		return createToken(user, refreshTokenExpirationMs, REFRESH_TOKEN_TYPE);
	}

	/**
	 * access token을 검증한다.
	 */
	public boolean validateAccessToken(String token) {
		return validateToken(token, ACCESS_TOKEN_TYPE);
	}

	/**
	 * refresh token을 검증한다.
	 */
	public boolean validateRefreshToken(String token) {
		return validateToken(token, REFRESH_TOKEN_TYPE);
	}

	/**
	 * 토큰에서 사용자 ID를 추출한다.
	 */
	@NonNull
	public Long getUserId(String token) {
		return Long.parseLong(parseClaims(token).getSubject());
	}

	private String createToken(User user, long expirationMs, String tokenType) {
		Instant now = Instant.now();
		Instant expiry = now.plusMillis(expirationMs);

		return Jwts.builder()
			.subject(String.valueOf(user.getId()))
			.claim(TOKEN_TYPE_CLAIM, tokenType)
			.claim("email", user.getEmail())
			.claim("displayName", user.getDisplayName())
			.claim(Claims.ISSUED_AT, now.getEpochSecond())
			.claim(Claims.EXPIRATION, expiry.getEpochSecond())
			.signWith(secretKey)
			.compact();
	}

	private boolean validateToken(String token, String expectedType) {
		try {
			Claims claims = parseClaims(token);

			return expectedType.equals(claims.get(TOKEN_TYPE_CLAIM, String.class));
		}
		catch (JwtException | IllegalArgumentException ex) {
			return false;
		}
	}

	private Claims parseClaims(String token) {
		return Jwts.parser()
			.verifyWith(secretKey)
			.build()
			.parseSignedClaims(token)
			.getPayload();
	}

}
