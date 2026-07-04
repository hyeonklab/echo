package com.echo.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.echo.domain.RoomMember;
import com.echo.domain.RoomMemberId;

/**
 * 채팅방 참여자 저장소.
 */
public interface RoomMemberRepository extends JpaRepository<RoomMember, RoomMemberId> {

	List<RoomMember> findAllByRoom_IdOrderByJoinedAtAsc(Long roomId);

	boolean existsByRoom_IdAndUser_Id(Long roomId, Long userId);

	void deleteByRoom_IdAndUser_Id(Long roomId, Long userId);

	long countByRoom_Id(Long roomId);

}
