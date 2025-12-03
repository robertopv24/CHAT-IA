# ==========================================================
#        SERVIDOR FOXIA - PLANTILLA BASE COMPLETA
#  Todas las dependencias e imports, pero con lógica simulada.
# ==========================================================

# --- SECCIÓN 0: INSTALACIÓN DE DEPENDENCIAS (COMPLETA) ---
# Asegúrate de ejecutar esto en una celda previa para tener todo listo.
!apt-get update -qq > /dev/null
!apt-get install -y tesseract-ocr libtesseract-dev > /dev/null
!pip install -q torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu121
!pip install -q faiss-cpu
!pip install -q fastapi uvicorn pyngrok nest_asyncio requests transformers accelerate bitsandbytes safetensors sentence-transformers python-multipart pypdf PyMuPDF python-docx chardet "unstructured[local-inference]" pdf2image pytesseract duckduckgo-search beautifulsoup4 networkx matplotlib psutil pynvml
!pip install --upgrade "httpx[http2]==0.28.1" -q

import requests
import os
import base64
import json
import threading
import time
import atexit
import asyncio
import ast
import torch
import faiss
import networkx as nx
import numpy as np
import logging
import psutil
import pynvml
import nest_asyncio
import uvicorn
import re
import signal
import textwrap
from fastapi import FastAPI, File, UploadFile, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pyngrok import ngrok
from typing import Dict, Any, List, Tuple, Optional
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline, BitsAndBytesConfig
from sentence_transformers import SentenceTransformer


# --- SECCIÓN 1: CONFIGURACIÓN INICIAL Y REMOTA ---
print("--- [PLANTILLA DEFINITIVA] Iniciando... ---")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
logger = logging.getLogger("FoxiaServer")

# URL del proxy PHP (se recomienda usar IP directa para evitar problemas de DNS en Colab)
CLIENT_PROXY_URL = "https://38.171.12.151:4430/proxy.php"
REMOTE_CONFIG = {}

try:
    logger.info(f"--> Obteniendo configuración desde: {CLIENT_PROXY_URL}")
    config_response = requests.get(f"{CLIENT_PROXY_URL}?action=get_config", verify=False, timeout=10)
    config_response.raise_for_status()
    REMOTE_CONFIG = config_response.json()
    logger.info("--> Configuración remota recibida con éxito.")

    # Asignar configuración a variables para fácil acceso
    os.environ["NGROK_AUTHTOKEN"] = REMOTE_CONFIG.get("ngrok_token", "")
    MODEL_ID = REMOTE_CONFIG.get("model_id", "deepseek-ai/deepseek-coder-6.7b-instruct")
    TEMPERATURE = float(REMOTE_CONFIG.get("temperature", 0.2))
    TOP_P = float(REMOTE_CONFIG.get("top_p", 0.9))
    MAX_NEW_TOKENS = int(REMOTE_CONFIG.get("max_new_tokens", 1024))

    logger.info(f"--> Modelo a usar: {MODEL_ID}")
    logger.info("--> Token de Ngrok configurado.")

except Exception as e:
    logger.fatal(f"FATAL: No se pudo obtener la configuración del proxy: {e}")
    raise SystemExit("Deteniendo el script.")


# --- SECCIÓN 2: CARGA DEL MODELO DE IA OPTIMIZADO ---
logger.info(f"--> Cargando el modelo '{MODEL_ID}' (esto puede tardar varios minutos)...")

# Cuantización a 4-bit para máximo rendimiento en VRAM y velocidad
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16
)

model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    quantization_config=quantization_config,
    device_map="auto",
    trust_remote_code=True
)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
# Configurar el token de padding para evitar advertencias de la librería
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

logger.info("✅ Modelo de IA cargado y listo (4-bit).")


# --- SECCIÓN 3: APLICACIÓN FASTAPI Y ENDPOINTS ---
app = FastAPI(title="Foxia Server - Plantilla Definitiva")

# Modelos Pydantic para validar los datos de entrada
class ClientConfig(BaseModel): settings: dict
class UserRequest(BaseModel): message: str

@app.get("/")
def read_root():
    """Devuelve un estado completo con la estructura que el cliente original espera."""
    return {
        "server_status": "Operativo",
        "operation_mode": "plantilla_definitiva",
        "system_metrics": {
            "cpu_used": psutil.cpu_percent(),
            "ram_used": psutil.virtual_memory().percent
        },
        "cognitive_stats": {
            "code_fragments": 0 # Valor simulado para compatibilidad
        }
    }

@app.post("/configurar")
async def configure_server(config: ClientConfig):
    """Endpoint para recibir la configuración que envía el cliente al iniciar."""
    logger.info(f"--> Configuración del cliente recibida y aceptada: {config.settings}")
    return {"status": "success", "message": "Configuración recibida por el servidor"}


@app.post("/generar")
async def generar_respuesta(request: UserRequest):
    """Llama al modelo de IA con una plantilla 'Few-Shot' para forzar el comportamiento correcto."""
    logger.info(f"Petición recibida en /generar: '{request.message}'")

    # --- MEJORA FINAL: Plantilla "Few-Shot" con ejemplos explícitos ---
    # Le mostramos al modelo exactamente cómo debe ser una conversación para que siga el patrón.
    prompt_template = textwrap.dedent(f"""
    A continuación se muestran ejemplos de una conversación con 'Foxia', un asistente de IA directo y servicial. Foxia debe continuar la conversación actual.

    ---
    ### User Instruction:
    ¿Cuál es la capital de Francia?

    ### Foxia's Answer:
    La capital de Francia es París.
    ---
    ### User Instruction:
    hola

    ### Foxia's Answer:
    Hola, ¿en qué puedo ayudarte?
    ---
    ### User Instruction:
    {request.message}

    ### Foxia's Answer:
    """).strip()

    try:
        inputs = tokenizer(prompt_template, return_tensors="pt").to(model.device)

        # Parámetros de generación obtenidos de la configuración remota
        generation_config = {
            "max_new_tokens": MAX_NEW_TOKENS,
            "do_sample": True,
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
            "pad_token_id": tokenizer.eos_token_id,
            "repetition_penalty": 1.13
        }

        logger.info("--> Generando respuesta con plantilla few-shot...")
        outputs = model.generate(**inputs, **generation_config)

        raw_response = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Parseo robusto para la nueva plantilla
        clean_response = raw_response.split("### Foxia's Answer:")[-1].strip()

        # Un chequeo final para limpiar cualquier repetición del patrón de ejemplo
        if "### User Instruction:" in clean_response:
            clean_response = clean_response.split("### User Instruction:")[0].strip()

        logger.info(f"--> Respuesta generada: '{clean_response[:80]}...'")
        return {"reply": clean_response}

    except Exception as e:
        logger.error(f"Error durante la generación de la respuesta: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- SECCIÓN 4: INICIO DEL SERVIDOR ---
try:
    ngrok.kill()
except:
    pass

logger.info("--> Iniciando túnel Ngrok...")
ngrok_tunnel = ngrok.connect(8000)
public_url = ngrok_tunnel.public_url

try:
    logger.info(f"--> Reportando URL pública al proxy: {public_url}")
    requests.post(f"{CLIENT_PROXY_URL}?action=update_url", json={"foxia_server_url": public_url}, timeout=10, verify=False)
    logger.info("--> URL reportada con éxito.")
except Exception as e:
    logger.warning(f"AVISO: No se pudo reportar la URL al proxy: {e}")

print("="*60)
print(f"✅ PLANTILLA DEFINITIVA ACTIVA EN: {public_url}")
print("="*60)

nest_asyncio.apply()
uvicorn.run(app, host="0.0.0.0", port=8000, log_config=None)
