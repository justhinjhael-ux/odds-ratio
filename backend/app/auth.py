"""Autenticación mínima del Panel Operativo (demo).

Token derivado por SHA-256 de credenciales fijas (env-configurables). En
producción se reemplazaría por OAuth2/SAML corporativo sin tocar el resto
de la API — el contrato es solo el header X-Operator-Token.
"""
import hashlib
import os

from fastapi import Header, HTTPException

OPERATOR_USER = os.getenv("OPERATOR_USER", "operador")
OPERATOR_PASS = os.getenv("OPERATOR_PASS", "oddsratio2026")


def _token() -> str:
    return hashlib.sha256(f"{OPERATOR_USER}:{OPERATOR_PASS}".encode()).hexdigest()


def verify_login(usuario: str, clave: str) -> str | None:
    if usuario == OPERATOR_USER and clave == OPERATOR_PASS:
        return _token()
    return None


def require_operator(x_operator_token: str = Header(default="")) -> str:
    if not x_operator_token or x_operator_token != _token():
        raise HTTPException(status_code=401, detail="Token de operador inválido o ausente")
    return x_operator_token
