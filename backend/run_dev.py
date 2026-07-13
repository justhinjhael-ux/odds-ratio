"""Lanzador de desarrollo local: agrega D:/pylibs (dependencias instaladas ahí
en esta máquina) y el propio directorio backend/ al sys.path antes de
arrancar uvicorn — funciona sin importar desde qué cwd se invoque."""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, "D:/pylibs")
sys.path.insert(0, BACKEND_DIR)
os.chdir(BACKEND_DIR)  # ## para que odds_ratio.db se cree junto al backend

try:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(BACKEND_DIR, ".env"))
except ImportError:
    pass

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
