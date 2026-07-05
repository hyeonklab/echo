package com.echo.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.echo.domain.Message;

/**
 * 메시지 저장소.
 */
public interface MessageRepository extends JpaRepository<Message, Long> {

	List<Message> findByRoom_IdOrderByCreatedAtDesc(Long roomId, Pageable pageable);

	List<Message> findByRoom_IdAndIdLessThanOrderByCreatedAtDesc(Long roomId, Long id, Pageable pageable);

	@Query("""
		SELECT m FROM Message m
		WHERE m.room.id = :roomId
		AND NOT EXISTS (
			SELECT 1 FROM MessageHidden mh
			WHERE mh.message.id = m.id AND mh.user.id = :userId
		)
		ORDER BY m.createdAt DESC
		""")
	List<Message> findVisibleByRoom_IdOrderByCreatedAtDesc(
		@Param("roomId") Long roomId,
		@Param("userId") Long userId,
		Pageable pageable
	);

	@Query("""
		SELECT m FROM Message m
		WHERE m.room.id = :roomId
		AND m.id < :beforeId
		AND NOT EXISTS (
			SELECT 1 FROM MessageHidden mh
			WHERE mh.message.id = m.id AND mh.user.id = :userId
		)
		ORDER BY m.createdAt DESC
		""")
	List<Message> findVisibleByRoom_IdAndIdLessThanOrderByCreatedAtDesc(
		@Param("roomId") Long roomId,
		@Param("beforeId") Long beforeId,
		@Param("userId") Long userId,
		Pageable pageable
	);

	Optional<Message> findTopByRoom_IdOrderByCreatedAtDesc(Long roomId);

	@Query("""
		SELECT m FROM Message m
		WHERE m.room.id = :roomId
		AND NOT EXISTS (
			SELECT 1 FROM MessageHidden mh
			WHERE mh.message.id = m.id AND mh.user.id = :userId
		)
		ORDER BY m.createdAt DESC
		""")
	List<Message> findVisibleByRoom_IdAndUser_IdOrderByCreatedAtDesc(
		@Param("roomId") Long roomId,
		@Param("userId") Long userId,
		Pageable pageable
	);

	@Query("""
		SELECT m FROM Message m
		WHERE m.id IN (
			SELECT MAX(m2.id) FROM Message m2
			WHERE m2.room.id IN :roomIds
			AND NOT EXISTS (
				SELECT 1 FROM MessageHidden mh
				WHERE mh.message.id = m2.id AND mh.user.id = :userId
			)
			GROUP BY m2.room.id
		)
		""")
	List<Message> findLatestVisibleMessagesByRoomIds(
		@Param("roomIds") Collection<Long> roomIds,
		@Param("userId") Long userId
	);

	@Query("""
		SELECT COUNT(m) FROM Message m
		WHERE m.room.id = :roomId
		AND m.sender.id <> :userId
		AND m.id > :afterMessageId
		""")
	long countUnreadAfter(
		@Param("roomId") Long roomId,
		@Param("userId") Long userId,
		@Param("afterMessageId") Long afterMessageId
	);

	@Query(value = """
		SELECT m.room_id, COUNT(*)::bigint
		FROM messages m
		LEFT JOIN room_read_states rrs
			ON rrs.room_id = m.room_id AND rrs.user_id = :userId
		WHERE m.room_id IN (:roomIds)
			AND m.sender_id <> :userId
			AND m.id > COALESCE(rrs.last_read_message_id, 0)
		GROUP BY m.room_id
		""", nativeQuery = true)
	List<Object[]> countUnreadByRoomIds(@Param("userId") Long userId, @Param("roomIds") Collection<Long> roomIds);

}
