package com.echo.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.echo.domain.Room;
import com.echo.domain.RoomType;

/**
 * 채팅방 저장소.
 */
public interface RoomRepository extends JpaRepository<Room, Long> {

	@Query("""
		SELECT DISTINCT rm.room
		FROM RoomMember rm
		WHERE rm.user.id = :userId
		ORDER BY rm.room.createdAt DESC
		""")
	List<Room> findAllByMemberUserId(@Param("userId") Long userId);

	@Query("""
		SELECT rm.room
		FROM RoomMember rm
		WHERE rm.room.type = :roomType
		GROUP BY rm.room
		HAVING SUM(CASE WHEN rm.user.id = :userId1 THEN 1 ELSE 0 END) > 0
		AND SUM(CASE WHEN rm.user.id = :userId2 THEN 1 ELSE 0 END) > 0
		AND COUNT(rm) = 2
		""")
	List<Room> findDmRoomsBetween(
		@Param("userId1") Long userId1,
		@Param("userId2") Long userId2,
		@Param("roomType") RoomType roomType
	);

}
