export function findUserByUsername(db, username) {
    return db
        .prepare("SELECT id, username, password_hash, password_salt, created_at FROM users WHERE username = ?")
        .bind(username)
        .first();
}

export async function createUser(db, username, passwordHash, passwordSalt, createdAt) {
    const result = await db
        .prepare(
            "INSERT INTO users (username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)"
        )
        .bind(username, passwordHash, passwordSalt, createdAt)
        .run();

    return result.meta.last_row_id;
}

export function createSession(db, tokenHash, userId, createdAt, expiresAt) {
    return db
        .prepare(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
        )
        .bind(tokenHash, userId, createdAt, expiresAt)
        .run();
}

export function findUserBySession(db, tokenHash, now) {
    return db
        .prepare(
            `SELECT users.id, users.username
             FROM sessions
             JOIN users ON users.id = sessions.user_id
             WHERE sessions.token_hash = ? AND sessions.expires_at > ?`
        )
        .bind(tokenHash, now)
        .first();
}

export function deleteSession(db, tokenHash) {
    return db
        .prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
}

export function getSave(db, userId) {
    return db
        .prepare("SELECT state_json, updated_at FROM saves WHERE user_id = ?")
        .bind(userId)
        .first();
}

export function upsertSave(db, userId, stateJson, updatedAt) {
    return db
        .prepare(
            `INSERT INTO saves (user_id, state_json, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at`
        )
        .bind(userId, stateJson, updatedAt)
        .run();
}
