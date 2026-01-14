# 🦊 Fox-IA: El Ecosistema de Chat Inteligente en Tiempo Real

[![Licencia](https://img.shields.io/badge/license-proprietary-red.svg)](LICENSE)
[![PHP](https://img.shields.io/badge/PHP-8.1+-777bb4.svg)](https://www.php.net/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776ab.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com/)
[![MariaDB](https://img.shields.io/badge/MariaDB-10.11+-003545.svg)](https://mariadb.org/)

**Fox-IA** no es solo un chat; es un ecosistema avanzado de **Inteligencia Artificial Distribuida**. Utiliza una arquitectura híbrida optimizada para ofrecer respuestas ultra-rápidas, personalizadas y seguras. Su núcleo combina la robustez de **PHP** para la orquestación y la potencia de los **LLMs modernos** (como DeepSeek) para la generación de lenguaje natural.

---

## 🚀 Características Avanzadas

### 🧠 Inteligencia con RAG Basado en Tripletas

A diferencia de los sistemas de chat tradicionales, Fox-IA utiliza una base de conocimientos estructurada mediante **tripletas (Sujeto - Predicado - Objeto)**.

- **Conocimiento Global**: Base de datos de hechos verificados que la IA puede consultar.
- **Contexto Dinámico**: La IA aprende de la conversación actual, extrayendo tripletas en tiempo real para mantener una memoria a corto y largo plazo precisa.
- **Búsqueda Semántica**: Procedimientos almacenados optimizados (`SearchKnowledge`) para recuperar la información más relevante en milisegundos.

### ⚡ Optimización de Modelos y Cuantización

- **4-bit Quantization (NF4)**: Los modelos se ejecutan usando `BitsAndBytes`, permitiendo cargar LLMs potentes (7B+ parámetros) en hardware de consumo o entornos limitados como Google Colab.
- **Inferencia Streaming**: Respuestas en tiempo real mediante *Server-Sent Events (SSE)* para una experiencia de usuario fluida.

### 🛠️ Arquitectura Multimodal y Escalable

- **Sistema de Nodos IA**: Escalado horizontal mediante registro de nodos externos (`api/ai/register-node`).
- **WebSockets de Alta Concurrencia**: Implementación con **Ratchet** para manejar miles de conexiones simultáneas sin latencia perceptible.
- **Gestión de Archivos**: Procesamiento de imágenes y documentos con generación de tokens de acceso seguro.

---

## 🏗️ Estructura del Proyecto

```text
📂 CHAT-IA
├── 📂 admin            # Panel de administración (HTML/JS)
├── 📂 bin              # Scripts ejecutables y binarios
├── 📂 public           # Punto de entrada web, activos y JS frontend
│   ├── 📂 assets       # Imágenes y recursos estáticos
│   ├── 📂 js           # Lógica compleja del cliente (Chat, UI, WebSockets)
│   └── 📂 uploads      # Almacenamiento seguro de archivos subidos
├── 📂 src              # El "Core" del sistema (PHP)
│   ├── 📂 AI           # Integración específica con el motor de IA
│   ├── 📂 Config       # Gestión de entorno y base de datos
│   ├── 📂 Controllers  # Lógica de endpoints (MVC)
│   ├── 📂 Middleware   # Seguridad (Auth, Admin, Rate Limiting)
│   ├── 📂 Services     # Capas de servicio (Mail, Uploads, ChatServer)
│   └── router.php      # Orquestador central de rutas
├── server.py           # Servidor de IA (Python/FastAPI)
├── foxia.sql           # Esquema de base de datos y procedimientos
└── server-websockets.sh # Script de arranque del servidor WebSocket
```

---

## 🛠️ Stack Tecnológico Detallado

### Backend PHP

- **Autenticación**: JWT (JSON Web Tokens) con rotación de sesiones.
- **Base de Datos**: MariaDB con uso intensivo de procedimientos almacenados y triggers para integridad referencial y auditoría.
- **Comunicación**: Servidor WebSocket independiente basado en Ratchet.
- **Servicios**: PHPMailer (validación de registros), mPDF (reportes), Predis (cacheo opcional).

### Nodo de IA (Python)

- **Framework**: FastAPI + Uvicorn.
- **LLM**: DeepSeek-R1-Distill-Qwen-7B (configurable).
- **Procesamiento**: PyTorch + Transformers (Hugging Face).
- **Embeddings**: Sentence Transformers para memoria contextual.

---

## 📦 Guía de Instalación Avanzada

### 1. Preparación del Entorno

Es vital configurar las variables de entorno correctamente en un archivo `.env` en la raíz:

```env
DB_HOST=localhost
DB_NAME=foxia
DB_USER=tu_usuario
DB_PASS=tu_contraseña

SMTP_HOST=smtp.ejemplo.com
SMTP_USER=user@ejemplo.com
SMTP_PASS=tu_pass

JWT_SECRET=tu_clave_secreta_super_larga
WS_PORT=8888
```

### 2. Base de Datos

Importa el esquema y los procedimientos:

```bash
mysql -u usuario -p foxia < foxia.sql
```

### 3. Servidor de IA (Python)

Para el nodo de IA, instala las dependencias de alta eficiencia:

```bash
pip install torch transformers fastapi uvicorn bitsandbytes accelerate sentence-transformers
python server.py
```

### 4. Servidor de Chat (WebSockets)

Ejecuta el servicio de tiempo real:

```bash
php bin/chat-server.php  # O usa el script .sh proporcionado
```

---

## 🛡️ Seguridad y Administración

Fox-IA incluye un **Panel de Administración** completo accesible en `/admin` para usuarios autorizados, donde se pueden:

- Monitorear estadísticas globales del sistema en tiempo real.
- Gestionar nodos de IA activos.
- Administrar usuarios, contactos y configuraciones de privacidad.
- Revisar logs de sistema y errores del frontend.

---

## 📄 Licencia

Este proyecto opera bajo una licencia **Propietaria**.
Queda prohibida la reproducción, distribución o modificación sin autorización expresa de **robertopv24**.

---
*Diseñado para ser la frontera entre la web clásica y la nueva generación de aplicaciones asistidas por IA.*
