"""
SQLite-backed persistence for learner profiles and session data.
Uses a single 'learners' table with JSON-serialised profile blobs.
"""
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "learners.db")
FAILED_PAYLOADS_PATH = os.path.join(os.path.dirname(__file__), "data", "failed_payloads.json")


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they do not exist."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS learners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                session_id TEXT NOT NULL UNIQUE,
                profile_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_session
            ON learners(session_id)
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS session_payloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                payload_json TEXT NOT NULL,
                submitted_at TEXT NOT NULL
            )
        """)
        conn.commit()


def save_learner(profile: dict):
    now = datetime.utcnow().isoformat()
    profile["updated_at"] = now
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO learners (student_id, session_id, profile_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                profile_json = excluded.profile_json,
                updated_at = excluded.updated_at
        """, (
            profile["student_id"],
            profile["session_id"],
            json.dumps(profile),
            profile.get("created_at", now),
            now,
        ))
        conn.commit()


def load_learner_by_student_id(student_id: str) -> Optional[dict]:
    """Return the most recent learner profile for a given student_id."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT profile_json FROM learners WHERE student_id = ? ORDER BY updated_at DESC LIMIT 1",
            (student_id,)
        ).fetchone()
    if row:
        return json.loads(row["profile_json"])
    return None


def load_learner(session_id: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT profile_json FROM learners WHERE session_id = ?",
            (session_id,)
        ).fetchone()
    if row:
        return json.loads(row["profile_json"])
    return None


def payload_exists(session_id: str) -> bool:
    """Return True if a final payload has already been submitted for this session."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM session_payloads WHERE session_id = ?",
            (session_id,)
        ).fetchone()
    return row is not None


def save_payload(session_id: str, payload: dict):
    """Insert payload. Raises if already submitted (one payload per session)."""
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO session_payloads (session_id, payload_json, submitted_at)
            VALUES (?, ?, ?)
        """, (session_id, json.dumps(payload), now))
        conn.commit()


def store_failed_payload(payload: dict):
    """Store a failed payload for later retry."""
    os.makedirs(os.path.dirname(FAILED_PAYLOADS_PATH), exist_ok=True)
    try:
        existing = []
        if os.path.exists(FAILED_PAYLOADS_PATH):
            with open(FAILED_PAYLOADS_PATH) as f:
                existing = json.load(f)
        existing.append({
            "payload": payload,
            "failed_at": datetime.utcnow().isoformat(),
            "retry_count": 0,
        })
        with open(FAILED_PAYLOADS_PATH, "w") as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        print(f"[DB] Could not store failed payload: {e}")


def get_failed_payloads() -> list:
    if not os.path.exists(FAILED_PAYLOADS_PATH):
        return []
    with open(FAILED_PAYLOADS_PATH) as f:
        return json.load(f)


def clear_failed_payload(session_id: str):
    if not os.path.exists(FAILED_PAYLOADS_PATH):
        return
    with open(FAILED_PAYLOADS_PATH) as f:
        existing = json.load(f)
    updated = [p for p in existing if p["payload"].get("session_id") != session_id]
    with open(FAILED_PAYLOADS_PATH, "w") as f:
        json.dump(updated, f, indent=2)
