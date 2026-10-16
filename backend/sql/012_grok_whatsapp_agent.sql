CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  external_message_id VARCHAR(255) UNIQUE,
  reply_to_message_id INTEGER REFERENCES conversation_messages(id) ON DELETE CASCADE,
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('pending', 'sending', 'sent')),
  delivery_attempted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversation_messages_history_idx
  ON conversation_messages (conversation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_reply_to_unique
  ON conversation_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
