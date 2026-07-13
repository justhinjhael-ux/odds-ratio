"""Proyección bayesiana de retornos — fan chart (Historia 2).

MODELO (versión normal-normal-v2-bankpriors)
============================================
Para cada clase de activo, el retorno mensual r se modela como Normal(μ, σ²)
con σ² conocida (estimada del histórico ficticio) y prior conjugado sobre μ:

    Prior:      μ ~ Normal(μ₀, τ₀²)
    Posterior:  μ | datos ~ Normal(μₙ, τₙ²)   (fórmulas conjugadas estándar)

        μₙ  = (μ₀/τ₀² + n·x̄/σ²) / (1/τ₀² + n/σ²)
        τₙ² = 1 / (1/τ₀² + n/σ²)

    Predictiva: r_futuro ~ Normal(μₙ, σ² + τₙ²)

PRIORS INFORMADOS POR LA PRÁCTICA BANCARIA (bank_priors_v1.json):
los bancos NO dejan los depósitos estancados — mantienen un encaje (~5%) y
reinvierten el resto (~75%) en cartera de crédito e inversiones, ganando el
spread entre tasa activa (~9.5% anual) y pasiva (~5.5% anual). Cada clase de
activo tiene su propio μ₀/τ₀ derivado de esas tasas:
  * renta fija     → anclada a la TASA PASIVA (lo que el banco paga al captar)
  * acciones       → ancladas a la TASA ACTIVA (a lo que el banco coloca)
  * fondos índice  → prima de riesgo intermedia
Ver justificación por clase en app/data/bank_priors_v1.json (versionado).

El portafolio se proyecta por MONTE CARLO: se simulan trayectorias del valor
acumulado y se reportan los percentiles 5/25/50/75/95 de cada mes.

POR DISEÑO nunca se entrega una única línea determinística: el fan chart
(mediana + bandas de credibilidad) comunica que es una DISTRIBUCIÓN de
posibilidades, no una promesa de rentabilidad (regla obligatoria del track).

El LLM no participa en ningún cálculo de este módulo (antialucinación).
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.data.fictitious_provider import data_provider

FORECAST_VERSION = "normal-normal-v2-bankpriors"

# Prior global de RESPALDO si una clase no está en bank_priors_v1.json
PRIOR_MU = 0.004     # 0.4% mensual
PRIOR_TAU = 0.02

BANK_PRIORS_PATH = Path(__file__).parent.parent / "data" / "bank_priors_v1.json"


@lru_cache(maxsize=1)
def load_bank_priors() -> dict:
    """Carga los priors bancarios versionados (encaje + reinversión + tasas)."""
    with open(BANK_PRIORS_PATH, encoding="utf-8") as f:
        return json.load(f)


def prior_for(asset_class: str) -> tuple[float, float]:
    """(μ₀, τ₀) del prior bancario de la clase; fallback al prior global."""
    priors = load_bank_priors()["priors"]
    if asset_class in priors:
        p = priors[asset_class]
        return float(p["mu0_mensual"]), float(p["tau0"])
    return PRIOR_MU, PRIOR_TAU

DISCLAIMER = (
    "SIMULACIÓN ILUSTRATIVA basada en datos ficticios y el modelo bayesiano "
    "normal-normal-v1. NO es una garantía ni promesa de rentabilidad."
)


def posterior_predictive(asset_class: str) -> dict:
    """Parámetros de la distribución predictiva del retorno mensual.

    El prior (μ₀, τ₀) viene de bank_priors_v1.json — informado por cómo la
    banca reinvierte los depósitos de sus clientes (encaje + tasas activa/pasiva).
    """
    datos = np.array(data_provider.get_historical_returns(asset_class))
    n = len(datos)
    xbar = float(datos.mean())
    sigma2 = float(datos.var(ddof=1))  # varianza muestral como σ² "conocida"

    mu0, tau0 = prior_for(asset_class)  # prior bancario por clase

    # Fórmulas conjugadas: mu_n = (μ₀/τ₀² + n·x̄/σ²) / (1/τ₀² + n/σ²)
    prec_prior = 1.0 / tau0**2
    prec_data = n / sigma2
    mu_n = (mu0 * prec_prior + n * xbar / sigma2) / (prec_prior + prec_data)
    tau_n2 = 1.0 / (prec_prior + prec_data)

    return {
        "clase": asset_class,
        "mu_posterior": mu_n,
        "var_predictiva": sigma2 + tau_n2,
        "n_observaciones": n,
        "prior_mu0": mu0,
        "prior_tau0": tau0,
        "prior_version": load_bank_priors()["_meta"]["version"],
        "version": FORECAST_VERSION,
    }


def forecast_portfolio(
    distribucion: dict[str, float],
    horizonte_meses: int = 60,
    monto_inicial: float = 10_000.0,
    n_sims: int = 4_000,
    seed: int = 123,
) -> dict:
    """Fan chart del valor del portafolio: percentiles 5/25/50/75/95 por mes.

    Args:
        distribucion: clase_activo -> porcentaje (suman ~100).
        horizonte_meses: horizonte declarado por el cliente.
        monto_inicial: capital simulado inicial (USD ficticios).

    Returns:
        dict con serie fan_chart, parámetros del modelo y disclaimer OBLIGATORIO.
    """
    total = sum(distribucion.values())
    if not (99.0 <= total <= 101.0):
        raise ValueError(f"La distribución debe sumar ~100%, suma {total}")

    pesos, mus, varianzas = [], [], []
    for clase, pct in distribucion.items():
        pp = posterior_predictive(clase)
        pesos.append(pct / total)
        mus.append(pp["mu_posterior"])
        varianzas.append(pp["var_predictiva"])

    pesos_arr = np.array(pesos)
    mu_port = float(np.dot(pesos_arr, mus))
    # Aproximación: clases independientes (documentado como simplificación MVP)
    var_port = float(np.dot(pesos_arr**2, varianzas))

    rng = np.random.default_rng(seed)  # semilla fija -> demo reproducible
    retornos = rng.normal(mu_port, np.sqrt(var_port), size=(n_sims, horizonte_meses))
    trayectorias = monto_inicial * np.cumprod(1 + retornos, axis=1)

    fan_chart = []
    for mes in range(horizonte_meses):
        col = trayectorias[:, mes]
        fan_chart.append(
            {
                "mes": mes + 1,
                "p05": round(float(np.quantile(col, 0.05)), 2),
                "p25": round(float(np.quantile(col, 0.25)), 2),
                "p50": round(float(np.quantile(col, 0.50)), 2),
                "p75": round(float(np.quantile(col, 0.75)), 2),
                "p95": round(float(np.quantile(col, 0.95)), 2),
            }
        )

    return {
        "monto_inicial": monto_inicial,
        "horizonte_meses": horizonte_meses,
        "retorno_mensual_esperado": round(mu_port, 6),
        "volatilidad_mensual": round(float(np.sqrt(var_port)), 6),
        "fan_chart": fan_chart,
        "modelo": FORECAST_VERSION,
        "n_simulaciones": n_sims,
        "disclaimer": DISCLAIMER,
    }
