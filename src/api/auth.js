import {
    createSession,
    createUser,
    deleteSession,
    findUserBySession,
    findUserByUsername
} from "../db/database.js";

const SESSION_COOKIE = "farmforge_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
// Cloudflare Workers WebCrypto accepts at most 100,000 PBKDF2 iterations per call.
const PBKDF2_ITERATIONS = 100_000;

function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...headers
        }
    });
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function validateCredentials(body) {
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
        return {
            error: "Username must be 3-32 characters using letters, numbers, _ or -."
        };
    }

    if (password.length < 8 || password.length > 128) {
        return {
            error: "Password must be 8-128 characters."
        };
    }

    return { username, password };
}

function bytesToBase64(bytes) {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hashPassword(password, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256"
        },
        keyMaterial,
        256
    );

    return new Uint8Array(bits);
}

async function verifyPassword(password, saltBase64, expectedHashBase64) {
    const actual = await hashPassword(password, base64ToBytes(saltBase64));
    const expected = base64ToBytes(expectedHashBase64);

    if (actual.length !== expected.length) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < actual.length; index += 1) {
        difference |= actual[index] ^ expected[index];
    }

    return difference === 0;
}

function randomToken() {
    return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
}

async function hashToken(token) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(token)
    );

    return bytesToBase64(new Uint8Array(digest));
}

function getCookie(request, name) {
    const cookieHeader = request.headers.get("Cookie");

    if (!cookieHeader) {
        return null;
    }

    for (const part of cookieHeader.split(";")) {
        const [cookieName, ...valueParts] = part.trim().split("=");

        if (cookieName === name) {
            return valueParts.join("=");
        }
    }

    return null;
}

function sessionCookie(token, request, maxAgeSeconds) {
    const isHttps = new URL(request.url).protocol === "https:";
    const secure = isHttps ? "; Secure" : "";
    return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

async function startSession(db, userId) {
    const token = randomToken();
    const tokenHash = await hashToken(token);
    const createdAt = Date.now();
    const expiresAt = createdAt + SESSION_DURATION_MS;

    await createSession(db, tokenHash, userId, createdAt, expiresAt);
    return token;
}

export async function authenticateRequest(request, env) {
    const token = getCookie(request, SESSION_COOKIE);

    if (!token) {
        return null;
    }

    const tokenHash = await hashToken(token);
    return findUserBySession(env.DB, tokenHash, Date.now());
}

export async function register(request, env) {
    const credentials = validateCredentials(await readJson(request));

    if (credentials.error) {
        return json({ error: credentials.error }, 400);
    }

    const existing = await findUserByUsername(env.DB, credentials.username);

    if (existing) {
        return json({ error: "That username is already taken." }, 409);
    }

    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const passwordHash = await hashPassword(credentials.password, salt);
        const createdAt = Date.now();

        const userId = await createUser(
            env.DB,
            credentials.username,
            bytesToBase64(passwordHash),
            bytesToBase64(salt),
            createdAt
        );

        const token = await startSession(env.DB, userId);

        return json(
            { ok: true, username: credentials.username },
            201,
            { "Set-Cookie": sessionCookie(token, request, SESSION_DURATION_MS / 1000) }
        );
    } catch (error) {
        console.error("Registration failed", error);
        return json({ error: "Could not create account." }, 500);
    }
}

export async function login(request, env) {
    const credentials = validateCredentials(await readJson(request));

    if (credentials.error) {
        return json({ error: credentials.error }, 400);
    }

    const user = await findUserByUsername(env.DB, credentials.username);

    if (!user) {
        return json({ error: "Invalid username or password." }, 401);
    }

    const valid = await verifyPassword(
        credentials.password,
        user.password_salt,
        user.password_hash
    );

    if (!valid) {
        return json({ error: "Invalid username or password." }, 401);
    }

    const token = await startSession(env.DB, user.id);

    return json(
        { ok: true, username: user.username },
        200,
        { "Set-Cookie": sessionCookie(token, request, SESSION_DURATION_MS / 1000) }
    );
}

export async function logout(request, env) {
    const token = getCookie(request, SESSION_COOKIE);

    if (token) {
        try {
            await deleteSession(env.DB, await hashToken(token));
        } catch (error) {
            console.error("Session cleanup failed", error);
        }
    }

    return json(
        { ok: true },
        200,
        { "Set-Cookie": sessionCookie("", request, 0) }
    );
}

export { json };
