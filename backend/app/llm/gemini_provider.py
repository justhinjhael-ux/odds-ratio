"""Proveedor Google Gemini API (candidato al premio "Best Use of Google Gemini").

Usa el SDK oficial google-genai. Si la API falla en vivo (cuota, red), cae al
MockLLMProvider para que la demo NUNCA se rompa — la explicación mock también
es fiel a los datos por construcción.
"""
import logging
import os

from app.llm.provider import LLMProvider, MockLLMProvider

logger = logging.getLogger("odds-ratio.gemini")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self) -> None:
        from google import genai

        self._client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self._fallback = MockLLMProvider()

    def generate(self, prompt: str) -> str:
        try:
            resp = self._client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )
            texto = (resp.text or "").strip()
            if not texto:
                raise ValueError("Respuesta vacía de Gemini")
            return texto
        except Exception as exc:  # noqa: BLE001 — resiliencia de demo
            logger.warning("Gemini falló (%s); usando proveedor mock determinístico", exc)
            return self._fallback.generate(prompt)
