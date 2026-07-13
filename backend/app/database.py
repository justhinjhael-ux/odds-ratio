"""Conexión SQLAlchemy + SQLite. Motor de base de datos del proyecto.

SQLite es suficiente para el alcance del hackathon (demo reproducible,
sin infraestructura externa) y se persiste en un volumen Docker en producción.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("ODDS_RATIO_DB", "sqlite:///./odds_ratio.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
