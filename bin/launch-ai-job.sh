#!/bin/bash

# --- CONFIGURACIÓN ---
# Obtener la ruta absoluta del directorio donde se encuentra este script
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
# Subir un nivel para encontrar la raíz del proyecto
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
# Ruta al ejecutable de PHP (en Fedora/RHEL suele estar aquí)
PHP_PATH="/usr/bin/php"
# Ruta al script de PHP que queremos ejecutar
PROCESSOR_SCRIPT="$PROJECT_DIR/bin/ai-processor.php"
# Archivo de log para ESTE SCRIPT .sh
LAUNCHER_LOG="/tmp/ai_launcher.log"

# --- EJECUCIÓN ---

# Escribir en el log que el script .sh FUE ejecutado
echo "=======================================" >> $LAUNCHER_LOG
echo "Lanzador de IA ejecutado en: $(date)" >> $LAUNCHER_LOG
echo "Argumentos recibidos: $@" >> $LAUNCHER_LOG
echo "Directorio del Proyecto: $PROJECT_DIR" >> $LAUNCHER_LOG
echo "Script a ejecutar: $PROCESSOR_SCRIPT" >> $LAUNCHER_LOG

# Verificar que el script de PHP existe
if [ ! -f "$PROCESSOR_SCRIPT" ]; then
    echo "ERROR: No se encuentra ai-processor.php en $PROCESSOR_SCRIPT" >> $LAUNCHER_LOG
    exit 1
fi

# Ejecutar el script de PHP en segundo plano, pasando TODOS los argumentos
# (ej. --chat_id=123 --message_id=456)
$PHP_PATH "$PROCESSOR_SCRIPT" "$@" >> $LAUNCHER_LOG 2>&1

echo "Proceso PHP de IA lanzado." >> $LAUNCHER_LOG
echo "=======================================" >> $LAUNCHER_LOG
