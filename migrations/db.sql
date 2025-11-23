CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

create table users (
    id varchar(255) primary key,
    name varchar(255),
    email varchar(255),
    password varchar(255),
    plan VARCHAR(50) DEFAULT 'Gratuito',
    timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
    avatar_url TEXT,
    streak_in_days INTEGER DEFAULT 0,
    goal_per_day INTEGER DEFAULT 0,
    reminder_email BOOLEAN DEFAULT TRUE,
    reminder_push BOOLEAN DEFAULT TRUE,
    weekly_summary BOOLEAN DEFAULT TRUE,
    ai_suggestions BOOLEAN DEFAULT FALSE,
    created_at timestamp default now(),
    updated_at timestamp default now()
);

CREATE TRIGGER update_timestamp
BEFORE UPDATE
ON users
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

create table decks (
    id varchar(255) primary key,
    name varchar(255),
    user_id varchar(255) references users(id),
    description TEXT,
    subject VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    created_at timestamp default now(),
    updated_at timestamp default now()
);

CREATE TRIGGER update_timestamp
BEFORE UPDATE
ON decks
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

create table flashcards (
    id varchar(255) primary key,
    question text,
    answer text,
    user_id varchar(255) references users(id),
    deck_id varchar(255) references decks(id),
    difficulty varchar(255) default 'medium',
    status varchar(255) default 'new' check (status in ('new', 'learning', 'mastered')),
    review_count integer,
    last_review_date timestamp,
    next_review_date timestamp default now(),
    created_at timestamp default now(),
    updated_at timestamp default now()
);

CREATE TRIGGER update_timestamp
BEFORE UPDATE
ON flashcards
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

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

create table card_generation_processes (
    id varchar(255) primary key,
    user_id varchar(255) references users(id),
    deck_id varchar(255) references decks(id),
    status varchar(50) default 'processing',
    created_at timestamp default now(),
    updated_at timestamp default now()
);

CREATE TRIGGER update_timestamp
BEFORE UPDATE
ON card_generation_processes
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();
