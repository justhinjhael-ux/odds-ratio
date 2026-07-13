"""Actualización bayesiana Beta-Binomial del perfil de riesgo.

MODELO (versión beta-binomial-v1)
=================================
Sea θ la probabilidad de que la clasificación de perfil producida por el motor
de reglas sea CORRECTA para este cliente (validada por el asesor humano).

    Prior:      θ ~ Beta(α₀=2, β₀=2)        (débilmente informativo, media 0.5)
    Likelihood: decisión del asesor ~ Bernoulli(θ)
    Posterior:  θ | datos ~ Beta(α₀ + éxitos, β₀ + fracasos)

RETROALIMENTACIÓN (Historia 3): cada decisión del asesor actualiza el posterior:
    approve -> α += 1.0            (la clasificación fue correcta)
    reject  -> β += 1.0            (la clasificación fue incorrecta)
    edit    -> α += 0.5, β += 0.5  (parcialmente correcta)

La CONFIANZA del sistema es la media del posterior E[θ] = α/(α+β), y el
intervalo de credibilidad al 90% se estima por muestreo Monte Carlo.

Este módulo es 100% determinístico/estadístico — el LLM jamás participa aquí
(mecanismo antialucinación, criterio de evaluación #3).
"""
import numpy as np
from sqlalchemy.orm import Session

from app.models import RiskPosterior

POSTERIOR_VERSION = "beta-binomial-v1"
PRIOR_ALPHA = 2.0
PRIOR_BETA = 2.0

# Pesos de actualización por decisión del asesor
DECISION_UPDATES: dict[str, tuple[float, float]] = {
    "approve": (1.0, 0.0),
    "edit": (0.5, 0.5),
    "reject": (0.0, 1.0),
}


def get_or_create_posterior(db: Session, client_id: int, perfil: str) -> RiskPosterior:
    post = (
        db.query(RiskPosterior)
        .filter_by(client_id=client_id, perfil=perfil)
        .one_or_none()
    )
    if post is None:
        post = RiskPosterior(
            client_id=client_id,
            perfil=perfil,
            alpha=PRIOR_ALPHA,
            beta=PRIOR_BETA,
            version=POSTERIOR_VERSION,
        )
        db.add(post)
        db.flush()
    return post


def update_posterior(db: Session, client_id: int, perfil: str, decision: str) -> RiskPosterior:
    """Retroalimenta el posterior con la decisión del asesor (Historia 3)."""
    if decision not in DECISION_UPDATES:
        raise ValueError(f"Decisión inválida: {decision}")
    d_alpha, d_beta = DECISION_UPDATES[decision]
    post = get_or_create_posterior(db, client_id, perfil)
    post.alpha += d_alpha
    post.beta += d_beta
    db.flush()
    return post


def confidence(alpha: float, beta: float) -> float:
    """Media del posterior Beta: E[θ] = α/(α+β)."""
    return alpha / (alpha + beta)


def credible_interval(
    alpha: float, beta: float, level: float = 0.90, n_samples: int = 20_000
) -> tuple[float, float]:
    """Intervalo de credibilidad por Monte Carlo (sin dependencia de scipy)."""
    rng = np.random.default_rng(7)  # semilla fija: resultado reproducible
    samples = rng.beta(alpha, beta, n_samples)
    lo = (1 - level) / 2
    return (
        float(np.quantile(samples, lo)),
        float(np.quantile(samples, 1 - lo)),
    )


def posterior_summary(post: RiskPosterior) -> dict:
    ci = credible_interval(post.alpha, post.beta)
    return {
        "perfil": post.perfil,
        "alpha": post.alpha,
        "beta": post.beta,
        "confianza": round(confidence(post.alpha, post.beta), 4),
        "intervalo_credibilidad_90": [round(ci[0], 4), round(ci[1], 4)],
        "version": post.version,
    }
