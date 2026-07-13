"""Interfaz LLMProvider — intercambiable (Gemini/mock/Claude/OpenAI) vía la
variable de entorno LLM_PROVIDER, sin tocar la lógica de negocio.
"""
import json
import os
import re
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, prompt: str) -> str:
        ...


class MockLLMProvider(LLMProvider):
    """Proveedor determinístico: extrae el JSON <DATOS> del prompt y redacta
    una plantilla fija con ESOS MISMOS números — por construcción, siempre
    pasa el guardrail antialucinación (validar_consistencia_numerica)."""

    name = "mock"

    def generate(self, prompt: str) -> str:
        match = re.search(r"<DATOS>(.*?)</DATOS>", prompt, re.DOTALL)
        if not match:
            return (
                "Propuesta generada según los modelos estadísticos vigentes. "
                "Un asesor humano autorizado revisará esta propuesta antes de "
                "cualquier acción. Simulación ilustrativa, no garantiza rentabilidad."
            )
        try:
            datos = json.loads(match.group(1))
        except json.JSONDecodeError:
            return (
                "Propuesta generada según los modelos estadísticos vigentes. "
                "Un asesor humano autorizado revisará esta propuesta antes de "
                "cualquier acción."
            )

        perfil = datos.get("perfil", "n/d")
        confianza = datos.get("confianza", 0)
        distribucion = datos.get("distribucion", [])
        proyeccion = datos.get("proyeccion_resumen", {})

        partes_distribucion = ", ".join(
            f"{d['nombre']} ({d['porcentaje']}%)" for d in distribucion
        )
        confianza_pct = round(confianza * 100, 1)

        texto = (
            f"Según tu perfil {perfil} (confianza bayesiana {confianza_pct}%), "
            f"proponemos distribuir tu portafolio en: {partes_distribucion}. "
            f"En una simulación ilustrativa a {datos.get('horizonte_meses', 'n/d')} meses, "
            f"el escenario pesimista (percentil 5) proyecta "
            f"{proyeccion.get('p05_final', 'n/d')} y el optimista (percentil 95) "
            f"{proyeccion.get('p95_final', 'n/d')}, con una mediana de "
            f"{proyeccion.get('p50_final', 'n/d')}. Esto es una simulación "
            f"ilustrativa, no una promesa de rentabilidad. Un asesor humano "
            f"autorizado revisará esta propuesta antes de cualquier acción."
        )
        return texto


def get_llm_provider() -> LLMProvider:
    provider_name = os.getenv("LLM_PROVIDER", "mock").lower()
    if provider_name == "gemini":
        try:
            from app.llm.gemini_provider import GeminiProvider

            return GeminiProvider()
        except Exception:
            return MockLLMProvider()
    return MockLLMProvider()
