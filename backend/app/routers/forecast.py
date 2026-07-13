"""Router /forecast — proyección Normal-Normal (fan chart) y Markowitz."""
from fastapi import APIRouter, HTTPException

from app.bayes import portfolio_optimizer, returns_forecast
from app.data.fictitious_provider import data_provider

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.post("")
def forecast(
    distribucion: dict[str, float],
    horizonte_meses: int = 60,
    monto_inicial: float = 10_000.0,
):
    try:
        return returns_forecast.forecast_portfolio(
            distribucion, horizonte_meses=horizonte_meses, monto_inicial=monto_inicial
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/asset-classes")
def asset_classes():
    return data_provider.get_catalog()


@router.get("/markowitz/{perfil}")
def markowitz(perfil: str):
    if perfil not in portfolio_optimizer.RISK_AVERSION:
        raise HTTPException(status_code=404, detail=f"Perfil desconocido: {perfil}")
    return portfolio_optimizer.optimize_for_profile(perfil)
