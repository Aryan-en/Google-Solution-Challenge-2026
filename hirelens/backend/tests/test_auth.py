"""Tests for authentication system."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from auth import hash_password, verify_password, create_access_token, decode_token


class TestPasswordHashing:
    def test_hash_and_verify(self):
        pwd = "mysecretpassword"
        hashed = hash_password(pwd)
        assert verify_password(pwd, hashed) is True

    def test_wrong_password(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_different_hashes(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        # Different salts produce different hashes
        assert h1 != h2
        # Both still verify
        assert verify_password("same", h1) is True
        assert verify_password("same", h2) is True


class TestJWT:
    def test_create_and_decode(self):
        token = create_access_token(user_id=1, username="testuser")
        payload = decode_token(token)
        assert payload["sub"] == "1"
        assert payload["username"] == "testuser"

    def test_invalid_token(self):
        import pytest
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            decode_token("invalid.token.here")

    def test_tampered_token(self):
        import pytest
        from fastapi import HTTPException
        token = create_access_token(user_id=1, username="testuser")
        parts = token.split(".")
        # Tamper with payload
        parts[1] = parts[1] + "x"
        tampered = ".".join(parts)
        with pytest.raises(HTTPException):
            decode_token(tampered)
