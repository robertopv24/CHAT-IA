# 🦊 Fox-IA: El Ecosistema de Chat Inteligente en Tiempo Real

[![Licencia](https://img.shields.io/badge/license-proprietary-red.svg)](LICENSE)
[![PHP](https://img.shields.io/badge/PHP-8.1+-777bb4.svg)](https://www.php.net/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776ab.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688.svg)](https://fastapi.tiangolo.com/)

**Fox-IA** es una plataforma avanzada de chat en tiempo real potenciada por Inteligencia Artificial de vanguardia. Diseñada con una arquitectura híbrida (PHP + Python), Fox-IA combina lo mejor del desarrollo web tradicional con la potencia de los modelos de lenguaje modernos (LLMs) como DeepSeek, optimizados para ejecutarse incluso en entornos con recursos limitados mediante cuantización de 4 bits.

---

## 🚀 Características Principales

- **💬 Chat en Tiempo Real**: Comunicación instantánea mediante WebSockets (Ratchet/PHP).
- **🧠 IA Avanzada (DeepSeek)**: Integración con modelos de lenguaje de última generación optimizados con cuantización de 4 bits para un rendimiento excepcional.
- **📂 Gestión de Archivos Inteligente**: Sube y comparte archivos en el chat con procesamiento optimizado.
- **🔔 Notificaciones Dinámicas**: Sistema de alertas en tiempo real para mantener el flujo de la conversación.
- **🛠️ Arquitectura de Nodos**: Servidor de IA independiente mediante FastAPI, permitiendo el escalado horizontal de la inteligencia.
- **🔒 Seguridad Robusta**: Autenticación mediante JWT, protección CSRF y manejo seguro de sesiones.

---

## 🛠️ Stack Tecnológico

### Backend (Core)

* **PHP 8.1+**: Motor principal para la lógica de negocio y gestión de usuarios.
- **MySQL**: Base de datos para persistencia de conversaciones y metadatos.
- **Ratchet**: WebSockets para comunicación bidireccional en tiempo real.
- **Composer**: Gestión de dependencias (Dotenv, JWT, PHPMailer, mPDF).

### Servidor de IA (Cerebro)

* **Python 3.10+**: Entorno de ejecución para modelos de ML.
- **FastAPI**: API de alto rendimiento para el servicio de inferencia.
- **Transformers (Hugging Face)**: Integración con modelos LLM.
- **BitsAndBytes**: Implementación de cuantización de 4 bits (NF4).
- **Sentence Transformers**: Generación de embeddings para capacidades RAG.

### Frontend

* **Vanilla JS**: Lógica de interfaz rápida y sin sobrecarga de frameworks.
- **CSS Dinámico**: Diseño premium con efectos de glassmorphism y micro-animaciones.

---

## 🏗️ Arquitectura del Sistema

Fox-IA utiliza un enfoque desacoplado:

1. **Frontend**: Interfaz de usuario interactiva que se comunica vía HTTP (REST) y WebSockets.
2. **Servidor Web (PHP)**: Gestiona la autenticación, base de datos y la orquestación de la lógica del chat.
3. **Servidor de IA (Python/FastAPI)**: Actúa como un nodo de procesamiento de IA. Recibe peticiones del backend PHP y devuelve respuestas generadas por el modelo DeepSeek.

---

## 📦 Instalación

### Requisitos Previos

- Servidor Web (Apache/Nginx) con soporte PHP 8.1+.
- MySQL 8.0+.
- Python 3.10+ con soporte CUDA (opcional, pero recomendado).
- Composer y Pip.

### Pasos de Configuración

1. **Clonar el repositorio**:

    ```bash
    git clone https://github.com/robertopv24/CHAT-IA.git
    cd CHAT-IA
    ```

2. **Configurar el Backend PHP**:

    ```bash
    composer install
    cp .env.example .env
    # Edita el archivo .env con tus credenciales de base de datos
    ```

3. **Importar Base de Datos**:
    Importa el archivo `foxia.sql` en tu instancia de MySQL.

4. **Configurar el Servidor de IA**:

    ```bash
    # Se recomienda usar un entorno virtual
    pip install -r requirements.txt # Si existe, o instala manualmente torch, transformers, fastapi
    python server.py
    ```

5. **Iniciar Servidor WebSockets**:

    ```bash
    bash server-websockets.sh
    ```

---

## 🛡️ Licencia

Este proyecto es de propiedad exclusiva (**Proprietary**). Todos los derechos reservados a [robertopv24](https://github.com/robertopv24).

---

## 🤝 Contacto

Desarrollado por **robertopv24**.
¡Si tienes alguna duda o sugerencia, no dudes en abrir un issue!

---
*Hecho con ❤️ por el equipo de Fox-IA*
