<?php
// src/services/ConfigService.php
namespace Foxia\Services;

use Foxia\Config\Database;
use PDO;

class ConfigService
{
    /** @var array|null Caché estática para las configuraciones */
    private static ?array $settings = null;

    /**
     * Inicializa el servicio cargando las configuraciones desde la DB si no están en caché.
     */
    private static function init(): void
    {
        if (self::$settings === null) {
            try {
                $database = new Database();
                $db = $database->getConnection();

                $stmt = $db->query("SELECT setting_key, setting_value, setting_type FROM system_settings");
                $dbSettings = $stmt->fetchAll(PDO::FETCH_ASSOC);

                self::$settings = [];
                foreach ($dbSettings as $setting) {
                    $value = self::castValue($setting['setting_value'], $setting['setting_type']);
                    self::$settings[$setting['setting_key']] = $value;
                }
            } catch (\Exception $e) {
                // Si la DB falla, el sistema se detiene de forma segura.
                error_log("FATAL: No se pudo cargar la configuración desde la base de datos: " . $e->getMessage());
                // En un entorno de producción, podrías tener valores de fallback aquí.
                self::$settings = [];
            }
        }
    }

    /**
     * Obtiene un valor de configuración.
     *
     * @param string $key La clave de la configuración.
     * @param mixed $default El valor a devolver si la clave no existe.
     * @return mixed
     */
    public static function get(string $key, $default = null)
    {
        self::init();
        return self::$settings[$key] ?? $default;
    }

    /**
     * Convierte el valor de la DB a su tipo correcto.
     */
    private static function castValue($value, $type)
    {
        switch ($type) {
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'number':
                return (int)$value;
            case 'json':
                return json_decode($value, true);
            default: // string
                return (string)$value;
        }
    }
}
