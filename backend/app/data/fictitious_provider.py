"""Proveedor de datos FICTICIO (catálogo + retornos históricos simulados).

Semilla fija -> demo reproducible. Diseñado para ser sustituido por un
proveedor real (Bloomberg/Refinitiv/bolsas locales) implementando la misma
interfaz DataProvider, sin tocar la lógica de negocio del resto del sistema.
"""
import numpy as np

from app.data.provider import DataProvider

SEED = 42
N_MESES_HISTORICO = 48

_CATALOGO = {
    "efectivo": {
        "nombre": "Efectivo / fondo money market",
        "riesgo": "muy bajo",
        "instrumentos": [
            {"ticker": "MMKT-USD", "nombre": "Fondo de liquidez USD", "tipo": "money_market"},
        ],
    },
    "renta_fija_local": {
        "nombre": "Renta fija local (Ecuador)",
        "riesgo": "bajo",
        "instrumentos": [
            {"ticker": "BEC-2028", "nombre": "Bono soberano Ecuador 2028", "tipo": "bono_soberano"},
            {"ticker": "CD-PICHINCHA", "nombre": "Certificado de depósito Banco Pichincha", "tipo": "deposito_plazo"},
        ],
    },
    "renta_fija_internacional": {
        "nombre": "Renta fija internacional",
        "riesgo": "bajo-medio",
        "instrumentos": [
            {"ticker": "AGG", "nombre": "iShares Core US Aggregate Bond ETF", "tipo": "etf_bonos"},
            {"ticker": "EMB", "nombre": "iShares JPMorgan EM Bond ETF", "tipo": "etf_bonos_emergentes"},
        ],
    },
    "fondos_indexados": {
        "nombre": "Fondos indexados globales",
        "riesgo": "medio",
        "instrumentos": [
            {"ticker": "VTI", "nombre": "Vanguard Total Stock Market ETF", "tipo": "etf_indexado"},
            {"ticker": "VXUS", "nombre": "Vanguard Total International Stock ETF", "tipo": "etf_indexado"},
        ],
    },
    "acciones": {
        "nombre": "Acciones globales",
        "riesgo": "alto",
        "instrumentos": [
            {"ticker": "AAPL", "nombre": "Apple Inc.", "tipo": "accion"},
            {"ticker": "MSFT", "nombre": "Microsoft Corp.", "tipo": "accion"},
            {"ticker": "NVDA", "nombre": "NVIDIA Corp.", "tipo": "accion"},
        ],
    },
}

# Volatilidad mensual objetivo por clase (desviación estándar ~ escala real
# de un mercado mensual: efectivo casi 0, acciones ~4-5%).
_VOLATILIDAD_MENSUAL = {
    "efectivo": 0.0008,
    "renta_fija_local": 0.006,
    "renta_fija_internacional": 0.009,
    "fondos_indexados": 0.022,
    "acciones": 0.045,
}


def _generar_retornos() -> dict[str, list[float]]:
    rng = np.random.default_rng(SEED)
    # Correlación fictícia realista: activos más riesgosos, más correlacionados
    # entre sí; efectivo prácticamente independiente.
    clases = list(_CATALOGO.keys())
    n = len(clases)
    corr = np.eye(n)
    correlaciones_pares = {
        ("renta_fija_local", "renta_fija_internacional"): 0.35,
        ("renta_fija_internacional", "fondos_indexados"): 0.25,
        ("fondos_indexados", "acciones"): 0.55,
        ("renta_fija_local", "fondos_indexados"): 0.10,
        ("renta_fija_internacional", "acciones"): 0.20,
    }
    idx = {c: i for i, c in enumerate(clases)}
    for (a, b), rho in correlaciones_pares.items():
        corr[idx[a], idx[b]] = corr[idx[b], idx[a]] = rho

    vols = np.array([_VOLATILIDAD_MENSUAL[c] for c in clases])
    cov = np.outer(vols, vols) * corr
    medias = np.array([_VOLATILIDAD_MENSUAL[c] * 0.35 for c in clases])  # retorno medio proporcional a su vol

    muestras = rng.multivariate_normal(medias, cov, size=N_MESES_HISTORICO)
    return {c: muestras[:, i].tolist() for i, c in enumerate(clases)}


class FictitiousDataProvider(DataProvider):
    def __init__(self) -> None:
        self._retornos = _generar_retornos()

    def get_catalog(self) -> dict:
        return {"clases": _CATALOGO}

    def asset_classes(self) -> list[str]:
        return list(_CATALOGO.keys())

    def get_historical_returns(self, asset_class: str) -> list[float]:
        if asset_class not in self._retornos:
            raise ValueError(f"Clase de activo desconocida: {asset_class}")
        return self._retornos[asset_class]


data_provider = FictitiousDataProvider()
