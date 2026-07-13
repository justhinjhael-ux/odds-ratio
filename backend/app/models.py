"""Modelos SQLAlchemy — persistencia de Odds Ratio.

Tablas: clients · risk_profile_records · risk_posteriors · proposals ·
system_settings · chat_messages · advisor_decisions (append-only).
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class RiskProfileRecord(Base):
    __tablename__ = "risk_profile_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    proposal_id: Mapped[int | None] = mapped_column(
        ForeignKey("proposals.id"), nullable=True
    )
    rules_version: Mapped[str] = mapped_column(String(20), default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    perfil: Mapped[str] = mapped_column(String(30), default="")
    detalle: Mapped[dict] = mapped_column(JSON, default=dict)
    estratos: Mapped[dict] = mapped_column(JSON, default=dict)
    test_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    respuestas_meta: Mapped[list] = mapped_column(JSON, default=list)
    retroalimentacion_general: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class RiskPosterior(Base):
    __tablename__ = "risk_posteriors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    perfil: Mapped[str] = mapped_column(String(30))
    alpha: Mapped[float] = mapped_column(Float)
    beta: Mapped[float] = mapped_column(Float)
    version: Mapped[str] = mapped_column(String(30), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"))
    thread_id: Mapped[str] = mapped_column(String(100), unique=True)
    perfil: Mapped[str] = mapped_column(String(30), default="")
    confianza: Mapped[float] = mapped_column(Float, default=0.0)
    distribucion: Mapped[dict] = mapped_column(JSON, default=dict)
    proyeccion: Mapped[dict] = mapped_column(JSON, default=dict)
    explicacion: Mapped[str] = mapped_column(Text, default="")
    estado: Mapped[str] = mapped_column(String(30), default="pendiente")
    rules_version: Mapped[str] = mapped_column(String(20), default="")
    posterior_version: Mapped[str] = mapped_column(String(30), default="")
    guardrail_activado: Mapped[bool] = mapped_column(Boolean, default=False)
    llm_provider: Mapped[str] = mapped_column(String(30), default="")
    alerta_cumplimiento: Mapped[dict] = mapped_column(JSON, default=dict)
    autopilot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(60), unique=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(100), index=True)
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text, default="")
    escalado: Mapped[bool] = mapped_column(Boolean, default=False)
    guardrail_activado: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AdvisorDecision(Base):
    """Append-only: nunca se actualiza ni borra un registro, solo se agregan."""

    __tablename__ = "advisor_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey("proposals.id"))
    decision: Mapped[str] = mapped_column(String(20))  # approve | edit | reject
    asesor: Mapped[str] = mapped_column(String(100), default="")
    comentario: Mapped[str] = mapped_column(Text, default="")
    edits: Mapped[dict] = mapped_column(JSON, default=dict)
    rules_version: Mapped[str] = mapped_column(String(20), default="")
    posterior_version: Mapped[str] = mapped_column(String(30), default="")
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
