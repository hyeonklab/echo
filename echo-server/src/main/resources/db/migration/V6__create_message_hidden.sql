CREATE TABLE message_hidden (
    user_id     BIGINT NOT NULL,
    message_id  BIGINT NOT NULL,
    hidden_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, message_id),
    CONSTRAINT fk_message_hidden_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_message_hidden_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
);

CREATE INDEX idx_message_hidden_message_id ON message_hidden (message_id);
