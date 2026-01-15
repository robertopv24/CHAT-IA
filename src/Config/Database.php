<?php
// src/config/Database.php

namespace Foxia\Config;

use PDO;
use PDOException;

class Database
{
    private ?PDO $connection = null;
    private string $host;
    private string $name;
    private string $user;
    private string $password;
    private string $port;

    public function __construct()
    {
        // Cargar variables de entorno
        $this->host = $_ENV['DB_HOST'] ?? 'localhost';
        $this->name = $_ENV['DB_NAME'] ?? 'foxia';
        $this->user = $_ENV['DB_USER'] ?? 'root';
        $this->password = $_ENV['DB_PASSWORD'] ?? '';
        $this->port = $_ENV['DB_PORT'] ?? '3306';
    }

    public function getConnection(): PDO
    {
        if ($this->connection === null) {
            try {
                $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->name};charset=utf8mb4";

                $this->connection = new PDO($dsn, $this->user, $this->password, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_STRINGIFY_FETCHES => false
                ]);

                // Configuración adicional para asegurar compatibilidad con utf8mb4
                $this->connection->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

            } catch (PDOException $exception) {
                throw new PDOException(
                    "Error de conexión: " . $exception->getMessage(),
                    (int)$exception->getCode()
                );
            }
        }

        return $this->connection;
    }

    /**
     * 🔥 NUEVO MÉTODO: Resetea la conexión para forzar una reconexión en la próxima llamada a getConnection()
     */
    public function resetConnection(): void
    {
        $this->connection = null;
    }
}
