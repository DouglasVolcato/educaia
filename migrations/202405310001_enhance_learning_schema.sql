ALTER TABLE users
    ADD COLUMN plan VARCHAR(50) DEFAULT 'Gratuito',
    ADD COLUMN timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
    ADD COLUMN avatar_url TEXT,
    ADD COLUMN streak_in_days INTEGER DEFAULT 0,
    ADD COLUMN goal_per_day INTEGER DEFAULT 0,
    ADD COLUMN reminder_email BOOLEAN DEFAULT TRUE,
    ADD COLUMN reminder_push BOOLEAN DEFAULT TRUE,
    ADD COLUMN weekly_summary BOOLEAN DEFAULT TRUE,
    ADD COLUMN ai_suggestions BOOLEAN DEFAULT FALSE;

ALTER TABLE decks
    ADD COLUMN description TEXT,
    ADD COLUMN subject VARCHAR(255),
    ADD COLUMN tags TEXT[] DEFAULT '{}';

ALTER TABLE flashcards
    ADD COLUMN tags TEXT[] DEFAULT '{}',
    ADD COLUMN difficulty VARCHAR(50) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    ADD COLUMN source TEXT;

CREATE TABLE IF NOT EXISTS user_integrations (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    connected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TRIGGER update_timestamp
BEFORE UPDATE ON user_integrations
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();
