"""Interfaz DataProvider — permite sustituir el proveedor ficticio por datos
reales de mercado (Bloomberg/Refinitiv/bolsas locales) sin tocar la lógica
de negocio del resto del sistema."""
from abc import ABC, abstractmethod


class DataProvider(ABC):
    @abstractmethod
    def get_catalog(self) -> dict:
        ...

    @abstractmethod
    def asset_classes(self) -> list[str]:
        ...

    @abstractmethod
    def get_historical_returns(self, asset_class: str) -> list[float]:
        ...
