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
    tags text[],
    created_at timestamp default now(),
    updated_at timestamp default now()
);

CREATE TRIGGER update_timestamp
BEFORE UPDATE
ON flashcards
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();