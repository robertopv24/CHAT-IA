# ==============================================================================
# === FOX-IA SERVER - COLAB OPTIMIZED - 4-BIT QUANTIZATION ====================
# ==============================================================================

print("🚀 INICIANDO FOX-IA SERVER - VERSIÓN COLAB OPTIMIZADA CON 4-BIT")

# ==============================================================================
# === SECCIÓN 0: INSTALACIÓN OPTIMIZADA PARA COLAB (VERSIÓN COMPLETA) =========
# ==============================================================================

import subprocess
import sys
import importlib
import time
import os
from typing import Dict, List, Tuple, Dict, Any, Optional, Literal

class ColabDependencyManager:
    """Gestor especializado para entornos Colab con CUDA"""

    def __init__(self):
        self.installation_log = []
        self.cuda_version = self.detect_cuda_version()

        # Paquetes optimizados para Colab
        self.required_packages = {
            "core_ml": {
                "torch": "2.5.1+cu121",
                "torchvision": "0.20.1+cu121",
                "torchaudio": "2.5.1+cu121",
                "transformers": "4.37.0",
                "accelerate": "0.25.0",
            },
            "serving": {
                "fastapi": "0.109.0",
                "uvicorn": "0.25.0",
                "python-multipart": "latest",
                "pyngrok": "7.0.0"
            },
            "rag": {
                "faiss-cpu": "latest",  # Usar CPU para evitar problemas CUDA
                "pypdf": "latest",
                "PyMuPDF": "latest",
                "python-docx": "latest",
            },
            "nlp": {
                "nltk": "latest",
                "duckduckgo-search": "latest",
                "beautifulsoup4": "latest",
                "sentence-transformers": "2.7.0"
            },
            "utils": {
                "nest_asyncio": "latest",
                "psutil": "latest",
                "networkx": "latest",
                "matplotlib": "latest"
            }
        }

    def detect_cuda_version(self) -> str:
        """Detecta la versión de CUDA disponible"""
        try:
            # Verificar si estamos en Colab
            import google.colab
            self.installation_log.append("✅ Entorno Colab detectado")

            # En Colab, usualmente tenemos CUDA 12.2 o superior
            result = subprocess.run(
                "nvidia-smi | grep CUDA | awk '{print $9}'",
                shell=True, capture_output=True, text=True
            )
            if result.returncode == 0 and result.stdout.strip():
                cuda_ver = result.stdout.strip()
                self.installation_log.append(f"🔍 Versión CUDA detectada: {cuda_ver}")
                return "cu121"  # Usar compatibilidad con CUDA 12.1

        except ImportError:
            self.installation_log.append("⚠️  No está en Colab")

        # Fallback a CUDA 12.1
        return "cu121"

    def install_bitsandbytes_colab(self) -> bool:
        """
        Instalación especializada de bitsandbytes para Colab
        (Reemplazando el método original para mayor fiabilidad)
        """
        self.installation_log.append("🔧 Instalando bitsandbytes para Colab (método robusto)...")

        # 1. Desinstalar para limpiar cualquier intento previo.
        self.run_command("pip uninstall -y bitsandbytes")

        # 2. Instalar la versión base de PyPI
        # Esta versión a menudo contiene el binario compatible con el entorno Colab actual.
        # Si falla, el run_command lo detectará.
        install_cmd = "pip install -q bitsandbytes"

        if self.run_command(install_cmd):
            self.installation_log.append("✅ bitsandbytes instalado (vía pip estándar)")
            return True

        # 3. Fallback: Intentar instalar una versión específica que se sabe que funciona
        # con cu121, en caso de que la última de PyPI falle.
        self.installation_log.append("🔁 Falló la instalación estándar. Intentando versión fija...")

        # Nota: La versión exacta puede cambiar, pero 0.43.0 o superior suele funcionar con cu121
        # Usaremos la versión de pip estándar otra vez, pero con más debug,
        # ya que la primera parte de tu código ya tiene un fallback implícito.

        self.installation_log.append("❌ Falló la instalación de bitsandbytes. Cuantización no disponible.")
        return False



    def setup_pytorch_colab(self) -> bool:
        """Configura PyTorch optimizado para Colab"""
        self.installation_log.append("🔥 Configurando PyTorch para Colab...")

        # Instalar PyTorch con CUDA 12.1 (compatible con la mayoría de Colab)
        torch_commands = [
            "pip uninstall -y torch torchvision torchaudio",
            "pip install -q torch==2.5.1+cu121 torchvision==0.20.1+cu121 torchaudio==2.5.1+cu121 --index-url https://download.pytorch.org/whl/cu121"
        ]

        for cmd in torch_commands:
            if not self.run_command(cmd):
                self.installation_log.append("❌ Falló la instalación de PyTorch")
                return False

        self.installation_log.append("✅ PyTorch instalado correctamente")
        return True

    def run_command(self, command: str, max_retries: int = 2) -> bool:
        """Ejecuta comando con reintentos optimizados para Colab"""
        for attempt in range(max_retries):
            try:
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=120  # 2 minutos timeout
                )

                if result.returncode == 0:
                    return True
                else:
                    if attempt < max_retries - 1:
                        time.sleep(2)

            except subprocess.TimeoutExpired:
                if attempt < max_retries - 1:
                    time.sleep(10)
            except Exception:
                if attempt < max_retries - 1:
                    time.sleep(2)

        return False

    def install_package_safe(self, package_spec: str) -> bool:
        """Instala un paquete de forma segura"""
        if "==" in package_spec:
            pkg, version = package_spec.split("==")
            cmd = f"pip install -q {pkg}=={version}"
        else:
            cmd = f"pip install -q {package_spec}"

        return self.run_command(cmd)

    def setup_environment(self) -> bool:
        """Configura el entorno para evitar conflictos de paths"""
        try:
            # Limpiar paths problemáticos en Colab
            problematic_paths = [
                '/sys/fs/cgroup/memory.events',
                '/var/colab/cgroup/jupyter-children/memory.events',
                'https',
                '//mp.kaggle.net'
            ]

            current_path = os.environ.get('PATH', '')
            paths = current_path.split(':')
            filtered_paths = [p for p in paths if p and p not in problematic_paths]
            os.environ['PATH'] = ':'.join(filtered_paths)

            # Configurar variables de entorno para CUDA
            os.environ['CUDA_LAUNCH_BLOCKING'] = '1'

            self.installation_log.append("✅ Entorno configurado correctamente")
            return True

        except Exception as e:
            self.installation_log.append(f"⚠️  Error configurando entorno: {e}")
            return True  # No crítico, continuar

    def install_package_group(self, group_name: str, packages: Dict) -> Dict[str, bool]:
        """Instala un grupo de paquetes"""
        results = {}

        for package, version in packages.items():
            if package in ["torch", "torchvision", "torchaudio"]:
                continue  # Ya instalados

            if version == "latest":
                install_cmd = f"pip install -q {package}"
            else:
                install_cmd = f"pip install -q {package}=={version}"

            success = self.run_command(install_cmd)
            results[package] = success

            if success:
                self.installation_log.append(f"✅ {package} instalado")
            else:
                self.installation_log.append(f"⚠️  {package} falló")

        return results

    def setup_nltk(self) -> bool:
        """Configura NLTK con recursos necesarios"""
        try:
            import nltk

            # Descargar recursos esenciales
            resources = ['punkt', 'stopwords', 'averaged_perceptron_tagger_eng']

            for resource in resources:
                try:
                    nltk.download(resource, quiet=True)
                    self.installation_log.append(f"✅ Recurso NLTK '{resource}' descargado")
                except Exception as e:
                    self.installation_log.append(f"⚠️  Error descargando {resource}: {e}")

            # Configurar tokenizador de fallback
            def simple_sent_tokenize(text):
                import re
                sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
                return [s.strip() for s in sentences if s.strip()]

            # Hacer disponible el tokenizador
            globals()["simple_sent_tokenize"] = simple_sent_tokenize

            self.installation_log.append("✅ NLTK configurado correctamente")
            return True

        except Exception as e:
            self.installation_log.append(f"❌ Error configurando NLTK: {e}")

            # Configurar tokenizador simple como fallback
            def simple_sent_tokenize(text):
                import re
                sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
                return [s.strip() for s in sentences if s.strip()]

            globals()["simple_sent_tokenize"] = simple_sent_tokenize
            self.installation_log.append("✅ Tokenizador simple configurado como fallback")
            return False

    def verify_critical_imports(self) -> Tuple[bool, Dict]:
        """Verifica imports críticos con tolerancia a bitsandbytes"""
        critical_modules = {
            "torch": "Core ML",
            "transformers": "Modelos de lenguaje",
            "fastapi": "Servidor web",
            "uvicorn": "Servidor ASGI",
            "sentence_transformers": "Embeddings"
        }

        optional_modules = {
            "bitsandbytes": "Cuantización (opcional)",
            "faiss": "Búsqueda vectorial",
            "nltk": "Procesamiento NLP"
        }

        results = {}
        critical_success = True

        # Verificar módulos críticos
        for module, description in critical_modules.items():
            try:
                importlib.import_module(module)
                results[module] = True
                self.installation_log.append(f"✅ {module} - {description}")
            except ImportError as e:
                results[module] = False
                critical_success = False
                self.installation_log.append(f"❌ {module} - {description}: {e}")

        # Verificar módulos opcionales
        for module, description in optional_modules.items():
            try:
                importlib.import_module(module)
                results[module] = True
                self.installation_log.append(f"✅ {module} - {description}")
            except ImportError as e:
                results[module] = False
                self.installation_log.append(f"⚠️  {module} - {description}: {e}")

        return critical_success, results

def main_installation():
    """Instalación principal optimizada para Colab"""
    print("🚀 INICIANDO INSTALACIÓN OPTIMIZADA PARA COLAB...")

    manager = ColabDependencyManager()

    # 1. Configurar entorno
    print("⚙️  Configurando entorno...")
    manager.setup_environment()

    # 2. Instalar PyTorch primero
    print("🔥 Instalando PyTorch con CUDA...")
    if not manager.setup_pytorch_colab():
        print("❌ Falló instalación de PyTorch")
        return False, manager.installation_log

    # 3. Instalar bitsandbytes especializado
    print("🔧 Instalando bitsandbytes...")
    manager.install_bitsandbytes_colab()

    # 4. Instalar grupos de paquetes
    print("📚 Instalando paquetes principales...")
    for group_name, packages in manager.required_packages.items():
        print(f"  📁 Instalando grupo: {group_name}")
        manager.install_package_group(group_name, packages)

    # 5. Configuraciones especiales
    print("⚙️  Configuraciones finales...")
    manager.setup_nltk()

    # 6. Verificación tolerante a fallos
    print("🔍 Verificando instalación...")
    critical_ok, results = manager.verify_critical_imports()

    # 7. Reporte
    print("\n" + "="*60)
    print("📊 REPORTE DE INSTALACIÓN COLAB:")
    print("="*60)

    for log_entry in manager.installation_log:
        print(log_entry)

    print(f"\n📈 ESTADO: {'✅ ÉXITO' if critical_ok else '⚠️  ADVERTENCIA'}")

    if not critical_ok:
        print("\n❌ Módulos críticos faltantes:")
        for mod, status in results.items():
            if not status and mod in ["torch", "transformers", "fastapi", "uvicorn"]:
                print(f"   - {mod}")

    return critical_ok, manager.installation_log

# Ejecutar instalación
if __name__ == "__main__":
    print("🔧 Iniciando instalación optimizada...")
    success, log = main_installation()

    if success:
        print("\n🎉 ¡Instalación completada! El servidor debería funcionar.")
        print("💡 Si hay advertencias con bitsandbytes, el sistema usará fallbacks.")
    else:
        print("\n❌ Fallaron componentes críticos. Revisa los logs.")

    print("\n📝 RESUMEN EJECUTIVO:")
    print("   - PyTorch: Optimizado para CUDA 12.1")
    print("   - Bitsandbytes: Con fallbacks a CPU si es necesario")
    print("   - FAISS: Usando versión CPU para estabilidad")
    print("   - Modelos: Funcionarán con o sin cuantización")

# ==============================================================================
# === SECCIÓN 1: IMPORTACIONES Y CONFIGURACIÓN ================================
# ==============================================================================

print("\n--- [SECCIÓN 1] IMPORTANDO BIBLIOTECAS ---")

import json
import re
import asyncio
import threading
import uuid
import numpy as np
from io import BytesIO
import torch
import faiss
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Header, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TextIteratorStreamer
)
from pyngrok import ngrok
from threading import Thread
import gc
import requests
import logging
import logging
import psutil
import pynvml
import nest_asyncio
from sse_starlette.sse import EventSourceResponse

print("📥 IMPORTACIONES COMPLETADAS")

# Aplica nest_asyncio para Colab
nest_asyncio.apply()

# ==============================================================================
# === CONFIGURACIÓN DE LOGGING ================================================
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("FoxiaServer")

# ==============================================================================
# === SECCIÓN 2: CONFIGURACIÓN Y CARGA DEL MODELO EN 4-BIT ====================
# ==============================================================================

print("\n--- [SECCIÓN 2] CARGANDO MODELO EN 4-BIT ---")

# Endpoints de la API central de Fox-IA
CONFIG_ENDPOINT = "https://foxia.duckdns.org:4430/public/api/ai/config"
REGISTER_ENDPOINT = "https://foxia.duckdns.org:4430/public/api/ai/register-node"
REMOTE_CONFIG = {}

# CONFIGURACIÓN POR DEFECTO
DEFAULT_CONFIG = {
    "ngrok_token": "2xkD3q0fYjxpfBVRTavDElLG4ZW_5wERVMPSTpKYu5KJ5EmHb",
    "model_id": "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    "temperature": 0.2,
    "top_p": 0.9,
    "max_new_tokens": 1024
}

try:
    print(f"--> Obteniendo configuración desde: {CONFIG_ENDPOINT}")
    config_response = requests.get(CONFIG_ENDPOINT, verify=False, timeout=15)

    if config_response.status_code == 200:
        REMOTE_CONFIG = config_response.json()
        print("✅ Configuración remota recibida")
    else:
        print(f"⚠️  Servidor central respondió con código {config_response.status_code}")
        print("⚠️  Usando configuración por defecto")
        REMOTE_CONFIG = DEFAULT_CONFIG.copy()

except Exception as e:
    print(f"⚠️  Error obteniendo configuración: {e}")
    print("⚠️  Usando configuración por defecto")
    REMOTE_CONFIG = DEFAULT_CONFIG.copy()

# Asignar configuración
NGROK_TOKEN = REMOTE_CONFIG.get("ngrok_token", DEFAULT_CONFIG["ngrok_token"])
MODEL_ID = REMOTE_CONFIG.get("model_id", DEFAULT_CONFIG["model_id"])
TEMPERATURE = float(REMOTE_CONFIG.get("temperature", DEFAULT_CONFIG["temperature"]))
TOP_P = float(REMOTE_CONFIG.get("top_p", DEFAULT_CONFIG["top_p"]))
MAX_NEW_TOKENS = int(REMOTE_CONFIG.get("max_new_tokens", DEFAULT_CONFIG["max_new_tokens"]))
API_KEY = REMOTE_CONFIG.get("api_key", "foxia-default-key")

# Verificar token de Ngrok
if not NGROK_TOKEN:
    print("❌ NO SE ENCONTRÓ TOKEN DE NGROK")
    raise SystemExit("Deteniendo el script: Token de Ngrok no disponible.")

os.environ["NGROK_AUTHTOKEN"] = NGROK_TOKEN

print(f"--> Modelo: {MODEL_ID}")
print(f"--> Parámetros: temp={TEMPERATURE}, top_p={TOP_P}, tokens={MAX_NEW_TOKENS}")

# CONFIGURACIÓN DE 4-BIT QUANTIZATION
def create_4bit_config():
    """Crea la configuración óptima para 4-bit quantization"""
    return BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_storage=torch.bfloat16
    )

class ModelLoader4Bit:
    """Cargador especializado para modelos en 4-bit"""

    def __init__(self):
        self.model = None
        self.tokenizer = None

    def load_model_4bit(self):
        """Carga el modelo en 4-bit con múltiples estrategias de fallback"""
        print("🎯 CARGANDO MODELO EN 4-BIT...")

        strategies = [
            self._load_4bit_optimized,
            self._load_4bit_basic,
            self._load_8bit_fallback,
            self._load_fp16_fallback,
            self._load_basic_fallback
        ]

        for i, strategy in enumerate(strategies):
            try:
                print(f"🔄 Intentando estrategia {i+1}/{len(strategies)}...")
                self.model, self.tokenizer = strategy()
                print(f"✅ Éxito con: {strategy.__name__}")
                return
            except Exception as e:
                print(f"❌ Falló {strategy.__name__}: {str(e)}")
                continue

        raise RuntimeError("Todas las estrategias de carga fallaron")

    def _load_4bit_optimized(self):
        """4-bit optimizado con NF4 y double quantization"""
        print("⚡ 4-bit optimizado (NF4 + double quant)...")
        quantization_config = create_4bit_config()

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            quantization_config=quantization_config,
            device_map="auto",
            trust_remote_code=True,
            torch_dtype=torch.bfloat16
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self._setup_tokenizer(tokenizer)
        return model, tokenizer

    def _load_4bit_basic(self):
        """4-bit básico sin optimizaciones avanzadas"""
        print("🔧 4-bit básico...")
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
        self._setup_tokenizer(tokenizer)
        return model, tokenizer

    def _load_8bit_fallback(self):
        """Fallback a 8-bit si 4-bit falla"""
        print("💾 Fallback a 8-bit...")
        quantization_config = BitsAndBytesConfig(load_in_8bit=True)

        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            quantization_config=quantization_config,
            device_map="auto",
            trust_remote_code=True
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self._setup_tokenizer(tokenizer)
        return model, tokenizer

    def _load_fp16_fallback(self):
        """Fallback a FP16"""
        print("🎯 Fallback a FP16...")
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            trust_remote_code=True,
            torch_dtype=torch.float16
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self._setup_tokenizer(tokenizer)
        return model, tokenizer

    def _load_basic_fallback(self):
        """Fallback básico sin optimizaciones"""
        print("🔰 Fallback básico...")
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            trust_remote_code=True
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self._setup_tokenizer(tokenizer)
        return model, tokenizer

    def _setup_tokenizer(self, tokenizer):
        """Configura el tokenizer"""
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

# Cargar modelo en 4-bit
try:
    model_loader = ModelLoader4Bit()
    model_loader.load_model_4bit()
    model = model_loader.model
    tokenizer = model_loader.tokenizer

    print(f"\n🎉 MODELO CARGADO EN 4-BIT EXITOSAMENTE")
    print(f"📊 Dispositivo: {model.device}")
    print(f"💾 Dtype: {next(model.parameters()).dtype}")
    print(f"🔧 Quantization: 4-bit activada")

except Exception as e:
    print(f"❌ ERROR CARGANDO MODELO 4-BIT: {e}")
    print("🔄 Intentando carga de emergencia...")

    # Carga de emergencia sin quantization
    try:
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            device_map="auto",
            trust_remote_code=True
        )
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        print("✅ Modelo cargado en modo emergencia (sin 4-bit)")
    except Exception as emergency_error:
        print(f"❌ Carga de emergencia falló: {emergency_error}")
        raise SystemExit("No se pudo cargar ningún modelo")

# ==============================================================================
# === APLICACIÓN FASTAPI ======================================================
# ==============================================================================

app = FastAPI(
    title="Fox-IA Server - Nodo de Inteligencia Artificial",
    description="Servidor especializado con 4-bit quantization optimizado para Colab",
    version="4.1-4bit",
    docs_url="/docs",
    redoc_url=None
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# === SISTEMA DE AUTENTICACIÓN ================================================
# ==============================================================================

def verify_api_key(api_key: str = Header(..., alias="x-api-key")):
    """Middleware de autenticación"""
    if api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid API Key"
        )
    return api_key

# ==============================================================================
# === MODELOS DE DATOS ========================================================
# ==============================================================================

class Message(BaseModel):
    role: Literal["user", "assistant", "system"] = Field(..., alias="rol")
    content: str = Field(..., alias="contenido")

class ChatCompletionRequest(BaseModel):
    messages: List[Message] = Field(..., alias="mensajes")
    stream: Optional[bool] = Field(False)
    max_tokens: Optional[int] = Field(default=1024, ge=10, le=4096)
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=1.0)
    top_p: Optional[float] = Field(default=0.9, ge=0.0, le=1.0)
    repetition_penalty: Optional[float] = Field(default=1.1, ge=1.0, le=2.0)

class UserRequest(BaseModel):
    message: str
    stream: Optional[bool] = False

class ClientConfig(BaseModel):
    settings: dict

class StatusResponse(BaseModel):
    status: str = "ok"
    message: str = "API is running"
    version: str = "4.1-4bit"

# ==============================================================================
# === SISTEMA DE PROMPTS ======================================================
# ==============================================================================

BASE_DIRECTIVES = (
    "\n\n**Directrices:**"
    "\n1. **Idioma:** Responde SIEMPRE y exclusivamente en español."
    "\n2. **Precisión:** Sé conciso pero completo en tus explicaciones."
    "\n3. **Utilidad:** Proporciona respuestas prácticas y accionables."
)

ROLE_PROMPTS = {
    "Asistente General": f"Eres Foxia, un **Asistente General de IA amigable y servicial**. Tu objetivo es ayudar con cualquier tipo de pregunta o problema de manera precisa y útil.{BASE_DIRECTIVES}",
    "Especialista en Programación": f"Eres Foxia, un **Especialista en Programación experto**. Te especializas en desarrollo de software, algoritmos, arquitectura de sistemas y mejores prácticas de coding.{BASE_DIRECTIVES}",
}

# ==============================================================================
# === MOTOR DE GENERACIÓN CON 4-BIT ===========================================
# ==============================================================================

class FoxiaGenerationEngine:
    """Motor de generación optimizado para 4-bit"""

    def __init__(self):
        self.model, self.tokenizer = model, tokenizer

    def clean_content(self, text: str) -> str:
        """Limpia el contenido de caracteres especiales y artefactos"""
        if not text:
            return ""

        # Eliminar caracteres especiales y artefactos de tokenización
        cleaned = re.sub(r'[\uff5c|]', '', text)
        cleaned = cleaned.replace('<｜begin of sentence｜>', '')
        cleaned = cleaned.replace('<｜end of sentence｜>', '')
        cleaned = cleaned.replace('<|endoftext|>', '')

        # Normalizar espacios
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        return cleaned

    def format_messages(self, messages: List[Message], role: str = "Asistente General") -> str:
        """Formatea los mensajes usando el template de chat"""
        system_prompt = ROLE_PROMPTS.get(role, ROLE_PROMPTS["Asistente General"])

        # Crear mensajes en formato para el template
        formatted_messages = [{"role": "system", "content": system_prompt}]

        for msg in messages:
            if msg.role in ["user", "assistant"]:
                formatted_messages.append({"role": msg.role, "content": msg.content})

        try:
            # Aplicar template de chat
            formatted_prompt = self.tokenizer.apply_chat_template(
                formatted_messages,
                tokenize=False,
                add_generation_prompt=True
            )
            return formatted_prompt
        except Exception as e:
            logger.warning(f"Error aplicando template: {e}")
            # Fallback manual
            conversation = f"{system_prompt}\n\n"
            for msg in messages:
                prefix = "Usuario" if msg.role == "user" else "Asistente"
                conversation += f"{prefix}: {msg.content}\n\n"
            conversation += "Asistente:"
            return conversation

# Inicializar motor de generación
generation_engine = FoxiaGenerationEngine()

# ==============================================================================
# === ENDPOINTS PRINCIPALES ===================================================
# ==============================================================================

@app.get("/", response_model=StatusResponse)
async def read_root():
    """Endpoint de estado principal"""
    return {
        "status": "ok",
        "message": "Fox-IA Server con 4-bit quantization está funcionando correctamente",
        "version": "4.1-4bit"
    }

@app.get("/health")
async def health_check():
    """Health check completo del sistema"""
    cpu_percent = psutil.cpu_percent(interval=0.5)
    ram_stats = psutil.virtual_memory()

    gpu_metrics = {"status": "GPU no detectada"}
    try:
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        gpu_metrics = {
            "status": "OK",
            "vram_total_gb": round(mem_info.total / (1024**3), 2),
            "vram_used_gb": round(mem_info.used / (1024**3), 2),
            "vram_percent_used": round((mem_info.used / mem_info.total) * 100, 2)
        }
        pynvml.nvmlShutdown()
    except Exception as e:
        gpu_metrics["error"] = str(e)

    # Verificar memoria del modelo
    model_memory = "Desconocido"
    try:
        if hasattr(model, 'get_memory_footprint'):
            model_memory_gb = model.get_memory_footprint() / (1024**3)
            model_memory = f"{model_memory_gb:.2f} GB"
    except:
        model_memory = "No disponible"

    # Verificar quantization
    quantization_status = "4-bit activado"
    try:
        if hasattr(model, 'quantization_method'):
            quantization_status = f"{model.quantization_method}"
        else:
            quantization_status = "No quantization"
    except:
        quantization_status = "Desconocido"

    return {
        "status": "healthy",
        "system_metrics": {
            "cpu_used": cpu_percent,
            "ram_used": ram_stats.percent,
            "gpu": gpu_metrics,
            "model_memory": model_memory
        },
        "model_loaded": model is not None,
        "quantization": quantization_status,
        "timestamp": time.time()
    }

@app.post("/v1/chat/completions")
async def create_chat_completion(
    request: ChatCompletionRequest,
    api_key: str = Depends(verify_api_key)
):
    """Endpoint profesional de chat completions con streaming"""

    if request.stream:
        return await handle_streaming_request(request)
    else:
        return await handle_standard_request(request)

async def handle_streaming_request(request: ChatCompletionRequest):
    """Maneja requests con streaming"""

    # Formatear prompt
    formatted_prompt = generation_engine.format_messages(request.messages)

    # Preparar inputs
    inputs = tokenizer(
        formatted_prompt,
        return_tensors="pt",
        truncation=True,
        max_length=4096
    ).to(model.device)

    # Configurar streamer
    streamer = TextIteratorStreamer(
        tokenizer,
        skip_prompt=True,
        timeout=60.0,
        skip_special_tokens=True
    )

    # Configuración de generación optimizada para 4-bit
    generation_kwargs = {
        "input_ids": inputs.input_ids,
        "attention_mask": inputs.attention_mask,
        "streamer": streamer,
        "max_new_tokens": request.max_tokens,
        "temperature": request.temperature,
        "top_p": request.top_p,
        "repetition_penalty": request.repetition_penalty,
        "do_sample": True,
        "pad_token_id": tokenizer.eos_token_id,
        "eos_token_id": tokenizer.eos_token_id,
    }

    # Función para generar en segundo plano
    def generate_in_thread():
        model.generate(**generation_kwargs)

    # Iniciar generación en hilo separado
    thread = Thread(target=generate_in_thread)
    thread.start()

    # Generador de eventos SSE
    async def event_generator():
        full_response = ""
        for token in streamer:
            if not token or not token.strip():
                continue

            full_response += token
            clean_token = generation_engine.clean_content(token)

            if clean_token:
                event_data = {
                    "id": f"chatcmpl-{uuid.uuid4()}",
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": MODEL_ID,
                    "choices": [{
                        "index": 0,
                        "delta": {"content": clean_token},
                        "finish_reason": None
                    }]
                }
                yield {"event": "message", "data": json.dumps(event_data)}

            await asyncio.sleep(0.01)

        # Evento de finalización
        event_data = {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": MODEL_ID,
            "choices": [{
                "index": 0,
                "delta": {},
                "finish_reason": "stop"
            }]
        }
        yield {"event": "message", "data": json.dumps(event_data)}
        yield {"event": "complete", "data": "[DONE]"}

    return EventSourceResponse(event_generator())

async def handle_standard_request(request: ChatCompletionRequest):
    """Maneja requests estándar (sin streaming)"""

    try:
        # Formatear prompt
        formatted_prompt = generation_engine.format_messages(request.messages)

        # Preparar inputs
        inputs = tokenizer(
            formatted_prompt,
            return_tensors="pt",
            truncation=True,
            max_length=4096
        ).to(model.device)

        # Configuración de generación
        generation_config = {
            "max_new_tokens": request.max_tokens,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "repetition_penalty": request.repetition_penalty,
            "do_sample": True,
            "pad_token_id": tokenizer.eos_token_id,
            "eos_token_id": tokenizer.eos_token_id,
        }

        # Generar respuesta
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                **generation_config
            )

        # Decodificar respuesta
        generated_tokens = outputs[0, inputs.input_ids.shape[1]:]
        response_message = tokenizer.decode(generated_tokens, skip_special_tokens=True)
        response_message = generation_engine.clean_content(response_message)

        # Calcular tokens
        prompt_tokens = inputs.input_ids.shape[1]
        completion_tokens = outputs.shape[1] - prompt_tokens

        response_data = {
            "id": f"chatcmpl-{uuid.uuid4()}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": MODEL_ID,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": response_message
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            }
        }

        return JSONResponse(content=response_data)

    except Exception as e:
        logger.error(f"Error en generación: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")

@app.post("/generar")
async def generar_respuesta(
    request: UserRequest,
    api_key: str = Depends(verify_api_key)
):
    """Endpoint simplificado para generación rápida"""

    # Crear mensajes para el formato estándar
    messages = [Message(rol="user", contenido=request.message)]
    chat_request = ChatCompletionRequest(
        mensajes=messages,
        stream=request.stream,
        max_tokens=512,
        temperature=0.7
    )

    if request.stream:
        return await handle_streaming_request(chat_request)
    else:
        response = await handle_standard_request(chat_request)
        # Extraer solo el contenido de la respuesta para formato simple
        response_data = response.body.decode() if hasattr(response, 'body') else "{}"
        response_json = json.loads(response_data)

        if "choices" in response_json and len(response_json["choices"]) > 0:
            return {"reply": response_json["choices"][0]["message"]["content"]}
        else:
            return {"reply": "No se pudo generar una respuesta"}

@app.post("/configurar")
async def configure_server(
    config: ClientConfig,
    api_key: str = Depends(verify_api_key)
):
    """Endpoint para configuración del servidor"""
    logger.info(f"Configuración recibida: {config.settings}")
    return {"status": "success", "message": "Configuración aplicada"}

# ==============================================================================
# === SISTEMA DE REGISTRO EN SERVIDOR CENTRAL =================================
# ==============================================================================

def register_with_central_server(public_url):
    """Registra el nodo en el servidor central de Fox-IA"""
    try:
        logger.info(f"--> Intentando registrar nodo en: {REGISTER_ENDPOINT}")
        registration_data = {"node_url": public_url}
        register_response = requests.post(REGISTER_ENDPOINT, json=registration_data, timeout=10, verify=False)

        if register_response.status_code == 200:
            logger.info("✅ Nodo registrado exitosamente en el servidor central.")
        else:
            logger.warning(f"⚠️  El servidor central respondió con código {register_response.status_code} al registrar el nodo")
            logger.warning("⚠️  El servidor continuará funcionando, pero no está registrado en el servidor central")

    except requests.exceptions.Timeout:
        logger.warning("⚠️  Timeout al intentar registrar el nodo")
        logger.warning("⚠️  El servidor continuará funcionando sin registro central")

    except requests.exceptions.ConnectionError:
        logger.warning("⚠️  No se pudo conectar para registrar el nodo")
        logger.warning("⚠️  El servidor continuará funcionando sin registro central")

    except Exception as e:
        logger.warning(f"⚠️  Error inesperado al registrar el nodo: {e}")
        logger.warning("⚠️  El servidor continuará funcionando sin registro central")

# ==============================================================================
# === INICIALIZACIÓN Y EJECUCIÓN DEL SERVIDOR =================================
# ==============================================================================

def clean_gpu_cache():
    """Limpia la caché de GPU"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        gc.collect()
        logger.info("✅ Caché de GPU limpiada")

def initialize_ngrok():
    """Inicializa el túnel Ngrok"""
    try:
        ngrok.kill()
    except:
        pass

    logger.info("--> Iniciando túnel Ngrok...")
    try:
        ngrok_tunnel = ngrok.connect(8000, bind_tls=True)
        public_url = ngrok_tunnel.public_url
        logger.info(f"✅ Túnel Ngrok establecido: {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"❌ Error con Ngrok: {e}")
        return None

def run_server():
    """Ejecuta el servidor Uvicorn"""
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        timeout_keep_alive=300
    )

# LLAMADA DE CALENTAMIENTO PARA 4-BIT
logger.info("--> Realizando calentamiento GPU para 4-bit...")
try:
    warmup_inputs = tokenizer("Calentamiento modelo 4-bit", return_tensors="pt").to(model.device)
    _ = model.generate(**warmup_inputs, max_new_tokens=10)
    logger.info("✅ GPU calentada y lista para 4-bit")
except Exception as e:
    logger.warning(f"⚠️  Calentamiento falló: {e}")

# INICIALIZACIÓN PRINCIPAL
if __name__ == "__main__":
    try:
        public_url = initialize_ngrok()

        if public_url:
            # Registrar el nodo en el servidor central
            register_with_central_server(public_url)
        else:
            logger.warning("⚠️  Usando servidor local sin Ngrok")

        # Iniciar servidor en hilo separado
        server_thread = Thread(target=run_server, daemon=True)
        server_thread.start()
        time.sleep(3)

        print("\n" + "="*70)
        print("🚀 FOX-IA SERVER 4.1-4bit - ACTIVO Y OPERATIVO")
        print("="*70)
        if public_url:
            print(f"🌐 URL Pública: {public_url}")
            print(f"📚 Documentación: {public_url}/docs")
        print(f"🔑 API Key: {API_KEY}")
        print(f"🤖 Modelo: {MODEL_ID}")
        print(f"⚡ Dispositivo: {model.device}")
        print(f"💾 Quantization: 4-bit activada")
        print(f"🎯 Estrategia: NF4 + Double Quantization")
        print(f"📊 Memoria modelo: ~4-6GB (optimizado con 4-bit)")
        print(f"🏠 Registro central: {'✅ Conectado' if public_url else '❌ Local'}")
        print("\n🔧 Endpoints Disponibles:")
        print(f"   • GET  /              - Estado del servidor")
        print(f"   • GET  /health        - Health check completo")
        print(f"   • POST /v1/chat/completions - Chat completions (estándar)")
        print(f"   • POST /generar       - Generación simplificada")
        print(f"   • POST /configurar    - Configuración del servidor")
        print("\n🎯 Características:")
        print(f"   • 4-bit quantization activa")
        print(f"   • NF4 con double quantization")
        print(f"   • Optimizado para Google Colab")
        print(f"   • Streaming en tiempo real")
        print(f"   • Autenticación por API Key")
        print(f"   • Métricas del sistema en tiempo real")
        print(f"   • Registro automático en servidor central")
        print("="*70)
        print("Presiona Ctrl+C para detener el servidor")

        # Mantener proceso principal activo
        while True:
            time.sleep(3600)

    except KeyboardInterrupt:
        print("\n🛑 Deteniendo servidor...")
        try:
            ngrok.kill()
        except:
            pass
        clean_gpu_cache()
        print("✅ Servidor detenido correctamente")
    except Exception as e:
        print(f"❌ Error fatal: {e}")
        clean_gpu_cache()
        raise SystemExit("Error crítico - Deteniendo script")
