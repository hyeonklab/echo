package com.echo.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.echo.domain.MessageHidden;
import com.echo.domain.MessageHiddenId;

/**
 * 메시지 숨김 저장소.
 */
public interface MessageHiddenRepository extends JpaRepository<MessageHidden, MessageHiddenId> {

	boolean existsById_UserIdAndId_MessageId(Long userId, Long messageId);

}
