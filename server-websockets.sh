#!/bin/bash

# Cambia al directorio donde se encuentra el script
cd "$(dirname "$0")"

echo "======================================="
echo "  Fox-IA WebSocket Server - Fedora"
echo "======================================="
echo ""

# 1. Verificar la configuración en un bucle
while true; do
    echo "🔧 Verificando configuración..."
    php bin/check-config.php

    if [ $? -eq 0 ]; then
        break
    else
        echo ""
        echo "❌ Error en la configuración. Corrige el archivo .env"
        echo "📁 El archivo .env debe estar en: $(pwd)/.env"
        echo ""
        read -n 1 -s -r -p "Presiona cualquier tecla para reintentar..."
        echo ""
    fi
done

# 2. Verificar el puerto 8888 y liberar si es necesario
echo ""
echo "🔌 Verificando puerto 8888..."
while ss -lnt | grep -q ":8888"; do
    echo "⚠️  Puerto 8888 en uso. Cerrando procesos PHP..."
    pkill -9 php
    sleep 3
done

echo "✅ Puerto 8888 disponible"

# 3. Iniciar el servidor WebSocket en un bucle para que se reinicie si falla
while true; do
    echo ""
    echo "🚀 Iniciando servidor WebSocket..."
    echo "📍 URL WebSocket: wss://foxia.duckdns.org/socket"
    echo ""

    php bin/websocket-server.php

    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Error en el servidor. Reiniciando en 10 segundos..."
        sleep 10
    else
        break
    fi
done

echo ""
echo "Servidor WebSocket detenido."
read -p "Presiona Enter para salir."
