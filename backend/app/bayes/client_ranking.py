"""Ranking bayesiano de clientes — priorización comercial autoalimentada.

MODELO (client-ranking-v1): Thompson sampling sobre el posterior Beta de cada
par (cliente, perfil) — el MISMO posterior que ya mantiene risk_posterior.py.

Para cada cliente se muestrea θ ~ Beta(α, β) (una realización aleatoria de la
confianza en su clasificación) y se pondera por el retorno mensual esperado de
su perfil (posterior_predictive agregado del catálogo). El score resultante es
"priorización informativa": el sistema NUNCA excluye ni discrimina clientes de
forma automática — solo sugiere a qué cliente conviene dar seguimiento antes,
y se recalcula solo con cada nueva decisión del asesor (autoalimentado).
"""
import numpy as np
from sqlalchemy.orm import Session

from app.bayes.returns_forecast import posterior_predictive
from app.data.fictitious_provider import data_provider
from app.models import Client, RiskPosterior
from app.rules import rules_engine

RANKING_VERSION = "client-ranking-v1"


def _retorno_esperado_perfil(perfil: str) -> float:
    asignacion = rules_engine.target_allocation(perfil)
    total = sum(asignacion.values()) or 1.0
    return sum(
        (pct / total) * posterior_predictive(clase)["mu_posterior"]
        for clase, pct in asignacion.items()
        if clase in data_provider.asset_classes()
    )


def ranking(db: Session, seed: int = 11) -> list[dict]:
    """Ordena clientes por score de Thompson sampling (mayor primero)."""
    rng = np.random.default_rng(seed)
    posteriores = db.query(RiskPosterior).all()

    filas = []
    for post in posteriores:
        cliente = db.get(Client, post.client_id)
        if cliente is None:
            continue
        theta_muestreado = float(rng.beta(post.alpha, post.beta))
        retorno_perfil = _retorno_esperado_perfil(post.perfil)
        score = theta_muestreado * retorno_perfil
        filas.append(
            {
                "client_id": post.client_id,
                "nombre": cliente.nombre,
                "perfil": post.perfil,
                "confianza_media": round(post.alpha / (post.alpha + post.beta), 4),
                "theta_muestreado": round(theta_muestreado, 4),
                "retorno_esperado_perfil": round(retorno_perfil, 6),
                "score": round(score, 6),
            }
        )

    filas.sort(key=lambda f: f["score"], reverse=True)
    return filas
