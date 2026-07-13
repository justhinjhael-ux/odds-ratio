"""Optimización de cartera Markowitz (Media-Varianza) — modelo estadístico #3.

TEORÍA MODERNA DE CARTERAS (Markowitz, 1952) — Separación de Dos Fondos
========================================================================
A diferencia de la asignación OFICIAL del sistema (determinística, por reglas
versionadas — ver rules_engine.target_allocation), este módulo calcula qué
diría la optimización clásica de cartera: maximizar el retorno esperado para
un nivel de riesgo dado, usando la covarianza real entre clases de activo.

    Retornos esperados (μ): el MISMO posterior bayesiano que ya calcula
    returns_forecast.posterior_predictive() — ningún número nuevo se inventa.

    Matriz de covarianza (Σ): calculada empíricamente de los MISMOS retornos
    históricos ficticios versionados que usa el resto del sistema.

    "Efectivo" (money market) hace de proxy del activo libre de riesgo — su
    varianza histórica es casi cero frente al resto, exactamente como en la
    teoría clásica. Por eso se aplica el TEOREMA DE SEPARACIÓN DE DOS FONDOS
    (Tobin 1958 / Sharpe 1964) en vez de un Σ⁻¹μ ingenuo sobre las 5 clases:
    invertir Σ⁻¹ con un activo de varianza ~0 en la mezcla vuelve la matriz
    numéricamente casi singular y el resultado deja de tener sentido económico.

    Paso 1 — Cartera tangente (solo activos riesgosos, sin efectivo):
        w_tan ∝ Σ_riesgo⁻¹ (μ_riesgo − r_f)     (long-only, recortado a ≥0)

    Paso 2 — Mezcla óptima riesgo/efectivo según aversión al riesgo λ:
        y = (μ_tan − r_f) / (λ · σ²_tan) ,  recortado a [0, 1]  (sin apalancar)
        cartera final = y · w_tan  +  (1 − y) · efectivo

    λ se ANCLA al perfil ya calculado por las reglas transparentes — no es
    una preferencia arbitraria del modelo.

PROPÓSITO Y LÍMITES:
  * Este módulo VALIDA/COMPARA la asignación transparente por reglas contra
    lo que sugeriría la teoría moderna de carteras — NUNCA la reemplaza. La
    propuesta oficial que revisa el asesor sigue siendo la determinística.
  * Por qué no LSTM/ARIMA/XGBoost/redes neuronales para este caso de uso: en
    asesoría financiera REGULADA, un modelo debe ser auditable caso por caso
    (un regulador puede pedir "explique por qué este cliente recibió esta
    cartera"). Bayes + Markowitz son matemáticamente transparentes: cada
    número se puede reconstruir a mano. Un modelo de deep learning es una
    caja negra — válido para señales de trading propietario, pero no para
    justificar una recomendación individual ante un regulador o un cliente.
"""
from functools import lru_cache

import numpy as np

from app.bayes.returns_forecast import posterior_predictive
from app.data.fictitious_provider import data_provider

OPTIMIZER_VERSION = "markowitz-mv-v2-twofund"

ACTIVO_LIBRE_DE_RIESGO = "efectivo"  # proxy del risk-free (varianza casi nula)

# Aversión al riesgo (λ) por perfil — recalibrada a la escala real de la
# varianza MENSUAL de los retornos ficticios (unidades ~1e-5). Ancla la
# teoría de carteras al MISMO perfil que ya clasifican las reglas
# transparentes (rules_engine), no es una preferencia arbitraria.
RISK_AVERSION: dict[str, float] = {
    "conservador": 200.0,  # λ alta: casi todo en el activo libre de riesgo
    "moderado": 80.0,
    "agresivo": 40.0,  # λ baja: satura la cartera tangente (100% riesgosos)
}


def _clases() -> list[str]:
    return data_provider.asset_classes()


def _clases_riesgosas() -> list[str]:
    return [c for c in _clases() if c != ACTIVO_LIBRE_DE_RIESGO]


def expected_returns() -> np.ndarray:
    """Vector μ: retorno mensual esperado (posterior bayesiano) por clase."""
    return np.array([posterior_predictive(c)["mu_posterior"] for c in _clases()])


@lru_cache(maxsize=1)
def covariance_matrix_riesgo() -> tuple:
    """Σ_riesgo: covarianza EMPÍRICA REAL entre los retornos históricos
    ficticios de las clases RIESGOSAS (excluye el activo libre de riesgo,
    cuya varianza casi nula vuelve la matriz completa mal condicionada).
    """
    series = np.array(
        [data_provider.get_historical_returns(c) for c in _clases_riesgosas()]
    )
    sigma = np.cov(series)
    return tuple(map(tuple, sigma))  # hashable para cachear


def tangency_portfolio() -> dict:
    """Cartera tangente long-only entre activos riesgosos (Paso 1).

    w_tan ∝ Σ_riesgo⁻¹ (μ_riesgo − r_f), recortada a pesos no negativos.
    Es la MISMA para cualquier perfil — el teorema de separación dice que
    solo cambia la MEZCLA con el activo libre de riesgo, no esta cartera.
    """
    riesgosas = _clases_riesgosas()
    mu = expected_returns()
    r_f = mu[_clases().index(ACTIVO_LIBRE_DE_RIESGO)]
    mu_riesgo = np.array([posterior_predictive(c)["mu_posterior"] for c in riesgosas])
    sigma = np.array(covariance_matrix_riesgo())

    exceso = mu_riesgo - r_f
    w_raw = np.linalg.solve(sigma, exceso)
    w_pos = np.clip(w_raw, 0, None)
    total = w_pos.sum()
    w_norm = w_pos / total if total > 0 else np.ones_like(w_pos) / len(w_pos)

    mu_tan = float(w_norm @ mu_riesgo)
    var_tan = float(w_norm @ sigma @ w_norm)
    return {
        "pesos": dict(zip(riesgosas, w_norm)),
        "retorno_esperado": mu_tan,
        "varianza": var_tan,
        "r_f": float(r_f),
    }


def optimize_for_profile(perfil: str) -> dict:
    """Cartera óptima Markowitz (separación de dos fondos) para el perfil
    ya calculado por las reglas transparentes.

    Devuelve pesos (%) sobre las 5 clases (incluye efectivo), retorno y
    volatilidad esperados, y la fracción invertida en activos riesgosos —
    todo calculado de μ y Σ reales, ningún valor se inventa.
    """
    lam = RISK_AVERSION.get(perfil, RISK_AVERSION["moderado"])
    tan = tangency_portfolio()

    # Paso 2: fracción óptima en la cartera tangente vs. efectivo
    y = (tan["retorno_esperado"] - tan["r_f"]) / (lam * tan["varianza"])
    y = float(np.clip(y, 0.0, 1.0))  # sin apalancar, sin posiciones cortas en cash

    pesos_pct = {c: round(w * y * 100, 2) for c, w in tan["pesos"].items()}
    pesos_pct[ACTIVO_LIBRE_DE_RIESGO] = round((1 - y) * 100, 2)

    retorno_esperado = y * tan["retorno_esperado"] + (1 - y) * tan["r_f"]
    varianza = (y**2) * tan["varianza"]  # efectivo aporta ~0 varianza
    vol = float(np.sqrt(max(varianza, 0)))
    ratio_retorno_riesgo = round(retorno_esperado / vol, 4) if vol > 0 else 0.0

    return {
        "perfil": perfil,
        "risk_aversion_lambda": lam,
        "fraccion_riesgosa": round(y, 4),
        "pesos": pesos_pct,
        "retorno_mensual_esperado": round(retorno_esperado, 6),
        "volatilidad_mensual": round(vol, 6),
        "ratio_retorno_riesgo": ratio_retorno_riesgo,
        "version": OPTIMIZER_VERSION,
        "nota": (
            "Cartera de referencia según teoría moderna de carteras (Markowitz, "
            "separación de dos fondos) — complementa, no reemplaza, la "
            "asignación oficial por reglas transparentes."
        ),
    }
