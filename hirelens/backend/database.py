"""SQLite database for users, analyses, and history."""

import sqlite3
import json
import os
from datetime import datetime, timezone
from typing import Any

DB_PATH = os.getenv("DATABASE_PATH", "hirelens.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            filename TEXT NOT NULL,
            target_column TEXT NOT NULL,
            protected_column TEXT NOT NULL,
            threshold REAL NOT NULL DEFAULT 0.5,
            bias_results TEXT NOT NULL,
            explanation TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    conn.commit()
    conn.close()


# ── User operations ──────────────────────────────────────────────────────

def create_user(username: str, password_hash: str) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        return cursor.lastrowid  # type: ignore[return-value]
    finally:
        conn.close()


def get_user_by_username(username: str) -> dict[str, Any] | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict[str, Any] | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


# ── Analysis operations ──────────────────────────────────────────────────

def save_analysis(
    user_id: int | None,
    filename: str,
    target_column: str,
    protected_column: str,
    threshold: float,
    bias_results: dict,
    explanation: dict | None = None,
) -> int:
    conn = get_db()
    try:
        cursor = conn.execute(
            """INSERT INTO analyses
               (user_id, filename, target_column, protected_column, threshold, bias_results, explanation)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id,
                filename,
                target_column,
                protected_column,
                threshold,
                json.dumps(bias_results),
                json.dumps(explanation) if explanation else None,
            ),
        )
        conn.commit()
        return cursor.lastrowid  # type: ignore[return-value]
    finally:
        conn.close()


def update_analysis_explanation(analysis_id: int, explanation: dict):
    conn = get_db()
    try:
        conn.execute(
            "UPDATE analyses SET explanation = ? WHERE id = ?",
            (json.dumps(explanation), analysis_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_analysis(analysis_id: int) -> dict[str, Any] | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM analyses WHERE id = ?", (analysis_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["bias_results"] = json.loads(d["bias_results"])
        if d["explanation"]:
            d["explanation"] = json.loads(d["explanation"])
        return d
    finally:
        conn.close()


def get_history(user_id: int | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """Get analysis history, optionally filtered by user."""
    conn = get_db()
    try:
        if user_id is not None:
            rows = conn.execute(
                "SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM analyses ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()

        results = []
        for row in rows:
            d = dict(row)
            d["bias_results"] = json.loads(d["bias_results"])
            if d["explanation"]:
                d["explanation"] = json.loads(d["explanation"])
            results.append(d)
        return results
    finally:
        conn.close()
