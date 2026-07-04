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

	Optional<Message> findTopByRoom_IdOrderByCreatedAtDesc(Long roomId);

	@Query("""
		SELECT m FROM Message m
		WHERE m.id IN (
			SELECT MAX(m2.id) FROM Message m2 WHERE m2.room.id IN :roomIds GROUP BY m2.room.id
		)
		""")
	List<Message> findLatestMessagesByRoomIds(@Param("roomIds") Collection<Long> roomIds);

}
