package com.echo.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.echo.domain.AuthProvider;
import com.echo.domain.User;

/**
 * 사용자 저장소.
 */
public interface UserRepository extends JpaRepository<User, Long> {

	Optional<User> findByProviderAndProviderId(AuthProvider provider, String providerId);

	/**
	 * 이름 또는 이메일로 사용자를 검색한다.
	 */
	@Query("""
		SELECT u FROM User u
		WHERE u.id <> :excludeUserId
		AND (
			LOWER(u.displayName) LIKE LOWER(CONCAT('%', :keyword, '%'))
			OR (u.email IS NOT NULL AND LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))
		)
		ORDER BY u.displayName
		""")
	List<User> searchUsers(
		@Param("keyword") String keyword,
		@Param("excludeUserId") Long excludeUserId,
		Pageable pageable
	);

}
