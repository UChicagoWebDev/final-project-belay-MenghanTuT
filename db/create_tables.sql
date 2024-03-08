-- -- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(40) NOT NULL UNIQUE,
    password VARCHAR(40) NOT NULL,
    api_key VARCHAR(40) NOT NULL UNIQUE
);

-- -- Channels Table
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(40) NOT NULL
);

-- -- Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body VARCHAR(40) NOT NULL,
    replies_to INTEGER, -- NULL for normal messages, contains message_id for replies
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (replies_to) REFERENCES messages(id)
);

