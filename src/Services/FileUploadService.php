<?php
// src/services/FileUploadService.php

namespace Foxia\Services;

use Exception;
use finfo;
use Foxia\Config\Database;
use PDO;

class FileUploadService
{
    // Configuración de uploads
    private const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private const ALLOWED_IMAGE_TYPES = [
        'image/avif' => 'jpg',      
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'image/webp' => 'webp',
        'image/svg+xml' => 'svg',
        'image/x-icon' => 'ico',
        'image/bmp' => 'bmp',
        'image/x-ms-bmp' => 'bmp'
    ];

    private const AVATAR_WIDTH = 200;
    private const AVATAR_HEIGHT = 200;
    private const AVATAR_QUALITY = 85;

    // Rutas de almacenamiento
    private const UPLOAD_BASE_DIR = __DIR__ . '/../../public/uploads/';
    private const AVATAR_DIR = 'avatars/';
    private const CHAT_FILES_DIR = 'chat_files/';
    private const TEMP_DIR = 'temp/';

    private static $db;

    /**
     * Inicializar conexión a base de datos
     */
    private static function initDB()
    {
        if (self::$db === null) {
            $database = new Database();
            self::$db = $database->getConnection();
        }
    }

    /**
     * Subir y procesar avatar de usuario
     */
    public static function uploadAvatar(array $file, int $userId): string
    {
        try {
            // Validaciones básicas del archivo
            self::validateUploadedFile($file);

            // Validar que es una imagen
            if (!self::isImageFile($file)) {
                throw new Exception('El archivo debe ser una imagen válida (JPEG, PNG, GIF, WebP)');
            }

            // Validar tamaño específico para avatares
            if ($file['size'] > self::MAX_FILE_SIZE) {
                throw new Exception('El avatar no puede ser mayor a 5MB');
            }

            // Obtener UUID del usuario
            $userUuid = self::getUserUuid($userId);
            if (!$userUuid) {
                throw new Exception('Usuario no encontrado');
            }

            // Crear directorio de avatares para el usuario si no existe
            $userAvatarDir = self::UPLOAD_BASE_DIR . self::AVATAR_DIR . $userUuid . '/';
            self::ensureDirectoryExists($userAvatarDir);

            // Generar nombre único para el archivo
            $fileExtension = self::getFileExtension($file['type']);
            $fileName = self::generateAvatarFileName($fileExtension);
            $filePath = $userAvatarDir . $fileName;

             // Procesar y redimensionar la imagen
            $processed = self::processAndResizeImage($file['tmp_name'], $filePath);

            if (!$processed) {
                throw new Exception('Error al procesar la imagen del avatar');
            }

            // Generar URL relativa para almacenar en BD
            $avatarUrl = '/uploads/' . self::AVATAR_DIR . $userUuid . '/' . $fileName;

            return $avatarUrl;

        } catch (Exception $e) {
            error_log("❌ Error subiendo avatar para usuario {$userId}: " . $e->getMessage());
            throw new Exception('Error al subir el avatar: ' . $e->getMessage());
        }
    }

    /**
     * Subir archivo para chat - CON MANEJO DE ERRORES MEJORADO
     */
    public static function uploadChatFile(array $file, int $userId, int $chatId): array
    {
        try {
            // Validaciones mejoradas
            if (!isset($file['tmp_name']) || !file_exists($file['tmp_name'])) {
                throw new Exception('Archivo temporal no encontrado');
            }

            if (!is_uploaded_file($file['tmp_name'])) {
                throw new Exception('Archivo no subido mediante HTTP POST');
            }

            // Validaciones básicas del archivo
            self::validateUploadedFile($file);

            // Obtener UUIDs del usuario y chat
            $userUuid = self::getUserUuid($userId);
            $chatUuid = self::getChatUuid($chatId);

            if (!$userUuid) {
                throw new Exception('Usuario no encontrado');
            }
            if (!$chatUuid) {
                throw new Exception('Chat no encontrado');
            }

            // Crear directorio de archivos para el chat/usuario si no existe
            $chatUserDir = self::UPLOAD_BASE_DIR . self::CHAT_FILES_DIR . $chatUuid . '/' . $userUuid . '/';
            self::ensureDirectoryExists($chatUserDir);

            // Generar nombre único para el archivo
            $originalName = pathinfo($file['name'], PATHINFO_FILENAME);
            $fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $fileName = self::generateChatFileName($fileExtension);
            $filePath = $chatUserDir . $fileName;

            // Mover el archivo
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                throw new Exception('No se pudo guardar el archivo en el servidor');
            }

            // Verificar que el archivo se movió correctamente
            if (!file_exists($filePath)) {
                throw new Exception('El archivo no se guardó correctamente');
            }

            // Generar información del archivo
            $fileInfo = [
                'original_name' => $originalName . '.' . $fileExtension,
                'stored_name' => $fileName,
                'file_path' => '/uploads/' . self::CHAT_FILES_DIR . $chatUuid . '/' . $userUuid . '/' . $fileName,
                'mime_type' => $file['type'],
                'file_size' => $file['size'],
                'upload_token' => bin2hex(random_bytes(16))
            ];

            error_log("✅ Archivo subido exitosamente: " . $fileInfo['original_name'] . " -> " . $fileInfo['file_path']);

            return $fileInfo;

        } catch (Exception $e) {
            error_log("❌ ERROR CRÍTICO en uploadChatFile: " . $e->getMessage());
            error_log("❌ File info: " . print_r($file, true));
            error_log("❌ User ID: $userId, Chat ID: $chatId");
            throw new Exception('Error al subir el archivo: ' . $e->getMessage());
        }
    }

    /**
     * Subir archivo temporal (para previsualización)
     */
    public static function uploadTempFile(array $file): string
    {
        try {
            // Validaciones básicas del archivo
            self::validateUploadedFile($file);

            // Crear directorio temporal si no existe
            $tempDir = self::UPLOAD_BASE_DIR . self::TEMP_DIR;
            self::ensureDirectoryExists($tempDir);

            // Generar nombre único
            $fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $fileName = uniqid('temp_', true) . '.' . $fileExtension;
            $filePath = $tempDir . $fileName;

            // Mover el archivo
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                throw new Exception('No se pudo guardar el archivo temporal');
            }

            return '/uploads/' . self::TEMP_DIR . $fileName;

        } catch (Exception $e) {
            error_log("❌ Error subiendo archivo temporal: " . $e->getMessage());
            throw new Exception('Error al subir el archivo temporal: ' . $e->getMessage());
        }
    }

    /**
     * Eliminar avatar
     */
    public static function deleteAvatar(string $avatarUrl): bool
    {
        try {
            if (empty($avatarUrl)) {
                return true;
            }

            // Convertir URL a ruta física
            $filePath = self::urlToFilePath($avatarUrl);

            // Verificar que el archivo existe y está en el directorio permitido
            if (file_exists($filePath) && self::isInUploadsDirectory($filePath)) {
                $deleted = unlink($filePath);

                // Intentar eliminar el directorio del usuario si está vacío
                if ($deleted) {
                    $userDir = dirname($filePath);
                    self::removeEmptyDirectory($userDir);

                    // Intentar eliminar el directorio de avatares si está vacío
                    $avatarsDir = dirname($userDir);
                    self::removeEmptyDirectory($avatarsDir);
                }

                return $deleted;
            }

            return true;

        } catch (Exception $e) {
            error_log("❌ Error eliminando avatar: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Eliminar archivo de chat
     */
    public static function deleteChatFile(string $filePath): bool
    {
        try {
            if (empty($filePath)) {
                return true;
            }

            // Convertir URL a ruta física
            $physicalPath = self::urlToFilePath($filePath);

            // Verificar que el archivo existe y está en el directorio permitido
            if (file_exists($physicalPath) && self::isInUploadsDirectory($physicalPath)) {
                $deleted = unlink($physicalPath);

                // Limpiar directorios vacíos recursivamente
                if ($deleted) {
                    $userDir = dirname($physicalPath);
                    self::removeEmptyDirectory($userDir);

                    $chatDir = dirname($userDir);
                    self::removeEmptyDirectory($chatDir);

                    $chatFilesDir = dirname($chatDir);
                    self::removeEmptyDirectory($chatFilesDir);
                }

                return $deleted;
            }

            return true;

        } catch (Exception $e) {
            error_log("❌ Error eliminando archivo de chat: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Eliminar todos los archivos de un usuario (cuando se desactiva la cuenta)
     */
    public static function deleteUserFiles(int $userId): bool
    {
        try {
            $userUuid = self::getUserUuid($userId);
            if (!$userUuid) {
                return true; // Usuario no existe, no hay archivos que eliminar
            }

            $success = true;

            // Eliminar directorio de avatares del usuario
            $userAvatarDir = self::UPLOAD_BASE_DIR . self::AVATAR_DIR . $userUuid . '/';
            if (is_dir($userAvatarDir) && self::isInUploadsDirectory($userAvatarDir)) {
                $success = $success && self::deleteDirectoryRecursive($userAvatarDir);
            }

            // Eliminar archivos de chat del usuario (buscar en todos los chats)
            $chatFilesBaseDir = self::UPLOAD_BASE_DIR . self::CHAT_FILES_DIR;
            if (is_dir($chatFilesBaseDir)) {
                $chats = scandir($chatFilesBaseDir);
                foreach ($chats as $chatUuid) {
                    if ($chatUuid === '.' || $chatUuid === '..') continue;

                    $userChatDir = $chatFilesBaseDir . $chatUuid . '/' . $userUuid . '/';
                    if (is_dir($userChatDir) && self::isInUploadsDirectory($userChatDir)) {
                        $success = $success && self::deleteDirectoryRecursive($userChatDir);

                        // Intentar eliminar directorio del chat si queda vacío
                        $chatDir = $chatFilesBaseDir . $chatUuid . '/';
                        self::removeEmptyDirectory($chatDir);
                    }
                }

                // Intentar eliminar directorio base de chat_files si queda vacío
                self::removeEmptyDirectory($chatFilesBaseDir);
            }

            return $success;

        } catch (Exception $e) {
            error_log("❌ Error eliminando archivos del usuario {$userId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Eliminar todos los archivos de un chat (cuando se elimina el chat)
     */
    public static function deleteChatFiles(int $chatId): bool
    {
        try {
            $chatUuid = self::getChatUuid($chatId);
            if (!$chatUuid) {
                return true; // Chat no existe, no hay archivos que eliminar
            }

            $chatDir = self::UPLOAD_BASE_DIR . self::CHAT_FILES_DIR . $chatUuid . '/';

            if (is_dir($chatDir) && self::isInUploadsDirectory($chatDir)) {
                return self::deleteDirectoryRecursive($chatDir);
            }

            return true;

        } catch (Exception $e) {
            error_log("❌ Error eliminando archivos del chat {$chatId}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Limpiar archivos temporales antiguos
     */
    public static function cleanupTempFiles(int $maxAgeHours = 24): int
    {
        try {
            $tempDir = self::UPLOAD_BASE_DIR . self::TEMP_DIR;
            $deletedCount = 0;

            if (!is_dir($tempDir)) {
                return 0;
            }

            $files = scandir($tempDir);
            $now = time();

            foreach ($files as $file) {
                if ($file === '.' || $file === '..') continue;

                $filePath = $tempDir . $file;
                if (filemtime($filePath) < ($now - ($maxAgeHours * 3600))) {
                    if (unlink($filePath)) {
                        $deletedCount++;
                    }
                }
            }

            error_log("🧹 Limpieza de archivos temporales: {$deletedCount} archivos eliminados");
            return $deletedCount;

        } catch (Exception $e) {
            error_log("❌ Error en limpieza de archivos temporales: " . $e->getMessage());
            return 0;
        }
    }

    /**
     * Validar archivo subido - CON MÁS DETALLES
     */
    private static function validateUploadedFile(array $file): void
    {
        // Verificar que no hay errores de upload
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errorMessages = [
                UPLOAD_ERR_INI_SIZE => 'El archivo excede el tamaño máximo permitido',
                UPLOAD_ERR_FORM_SIZE => 'El archivo excede el tamaño máximo del formulario',
                UPLOAD_ERR_PARTIAL => 'El archivo fue solo parcialmente subido',
                UPLOAD_ERR_NO_FILE => 'No se subió ningún archivo',
                UPLOAD_ERR_NO_TMP_DIR => 'Falta el directorio temporal',
                UPLOAD_ERR_CANT_WRITE => 'No se pudo escribir el archivo en el disco',
                UPLOAD_ERR_EXTENSION => 'Una extensión de PHP detuvo la subida del archivo'
            ];

            $message = $errorMessages[$file['error']] ?? 'Error desconocido al subir el archivo';
            throw new Exception($message);
        }

        // Verificar que es un archivo subido por POST
        if (!is_uploaded_file($file['tmp_name'])) {
            throw new Exception('Archivo no válido - no fue subido mediante HTTP POST');
        }

        // Verificar tamaño del archivo
        if ($file['size'] === 0) {
            throw new Exception('El archivo está vacío');
        }

        // Verificar que el archivo temporal existe
        if (!file_exists($file['tmp_name'])) {
            throw new Exception('El archivo temporal no existe');
        }

        // Verificar tipo MIME real del archivo
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);

        if (!$mimeType) {
            throw new Exception('No se pudo determinar el tipo de archivo');
        }

        // Log para debugging
        error_log("📁 Validación de archivo: " . $file['name'] . " | MIME: " . $mimeType . " | Tamaño: " . $file['size']);
    }

    /**
     * Verificar si el archivo es una imagen
     */
    private static function isImageFile(array $file): bool
    {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);

        return array_key_exists($mimeType, self::ALLOWED_IMAGE_TYPES);
    }

    /**
     * Obtener extensión de archivo basada en MIME type
     */
    private static function getFileExtension(string $mimeType): string
    {
        return self::ALLOWED_IMAGE_TYPES[$mimeType] ?? 'bin';
    }

    /**
     * Generar nombre único para avatar
     */
    private static function generateAvatarFileName(string $extension): string
    {
        $timestamp = time();
        $random = bin2hex(random_bytes(8));
        return "avatar_{$timestamp}_{$random}.{$extension}";
    }

    /**
     * Generar nombre único para archivo de chat
     */
    private static function generateChatFileName(string $extension): string
    {
        $timestamp = time();
        $random = bin2hex(random_bytes(8));
        return "file_{$timestamp}_{$random}.{$extension}";
    }

    /**
     * Obtener UUID del usuario
     */
    private static function getUserUuid(int $userId): ?string
    {
        try {
            self::initDB();
            $query = "SELECT uuid FROM users WHERE id = :user_id AND is_active = TRUE";
            $stmt = self::$db->prepare($query);
            $stmt->bindParam(':user_id', $userId, PDO::PARAM_INT);
            $stmt->execute();

            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? $result['uuid'] : null;

        } catch (Exception $e) {
            error_log("❌ Error obteniendo UUID del usuario {$userId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Obtener UUID del chat
     */
    private static function getChatUuid(int $chatId): ?string
    {
        try {
            self::initDB();
            $query = "SELECT uuid FROM chats WHERE id = :chat_id";
            $stmt = self::$db->prepare($query);
            $stmt->bindParam(':chat_id', $chatId, PDO::PARAM_INT);
            $stmt->execute();

            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? $result['uuid'] : null;

        } catch (Exception $e) {
            error_log("❌ Error obteniendo UUID del chat {$chatId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Asegurar que el directorio existe y tiene permisos
     */
    private static function ensureDirectoryExists(string $directory): void
    {
        if (!is_dir($directory)) {
            if (!mkdir($directory, 0755, true)) {
                throw new Exception("No se pudo crear el directorio: {$directory}");
            }
        }

        // Crear archivo index.html para prevenir listado de directorios
        $indexFile = $directory . 'index.html';
        if (!file_exists($indexFile)) {
            file_put_contents($indexFile, '<!DOCTYPE html><html><head><title>403 Forbidden</title></head><body><h1>Forbidden</h1><p>You don\'t have permission to access this directory.</p></body></html>');
        }
    }

    /**
     * Eliminar directorio recursivamente
     */
    private static function deleteDirectoryRecursive(string $dir): bool
    {
        if (!is_dir($dir)) {
            return true;
        }

        $files = array_diff(scandir($dir), ['.', '..']);

        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                self::deleteDirectoryRecursive($path);
            } else {
                unlink($path);
            }
        }

        return rmdir($dir);
    }

    /**
     * Eliminar directorio si está vacío
     */
    private static function removeEmptyDirectory(string $dir): bool
    {
        if (!is_dir($dir)) {
            return true;
        }

        // Verificar si el directorio está vacío (excluyendo .htaccess e index.html)
        $files = scandir($dir);
        $validFiles = array_diff($files, ['.', '..', '.htaccess', 'index.html']);

        if (empty($validFiles)) {
            // Eliminar archivos de protección primero
            $htaccess = $dir . '.htaccess';
            $index = $dir . 'index.html';

            if (file_exists($htaccess)) unlink($htaccess);
            if (file_exists($index)) unlink($index);

            return rmdir($dir);
        }

        return false;
    }

    /**
     * Crear imagen desde archivo según el tipo MIME
     */
    private static function createImageFromFile(string $path, string $mimeType)
    {
        switch ($mimeType) {
            case 'image/jpeg':
            case 'image/jpg':
                return imagecreatefromjpeg($path);
            case 'image/png':
                return imagecreatefrompng($path);
            case 'image/gif':
                return imagecreatefromgif($path);
            case 'image/webp':
                return imagecreatefromwebp($path);
            default:
                return null;
        }
    }

    /**
     * Configurar fondo de imagen según tipo
     */
    private static function setupImageBackground($image, string $mimeType): void
    {
        if ($mimeType === 'image/png' || $mimeType === 'image/gif') {
            imagealphablending($image, false);
            imagesavealpha($image, true);
            $transparent = imagecolorallocatealpha($image, 255, 255, 255, 127);
            imagefilledrectangle($image, 0, 0, self::AVATAR_WIDTH, self::AVATAR_HEIGHT, $transparent);
        } else {
            $white = imagecolorallocate($image, 255, 255, 255);
            imagefill($image, 0, 0, $white);
        }
    }

    /**
     * Calcular dimensiones de redimensionamiento manteniendo aspecto (SIN RECORTE)
     */
    private static function calculateResizeDimensions(int $srcWidth, int $srcHeight): array
    {
        // Calcular la relación de aspecto de la imagen original
        $srcAspect = $srcWidth / $srcHeight;
        $destAspect = self::AVATAR_WIDTH / self::AVATAR_HEIGHT;

        // Calcular nuevas dimensiones manteniendo la relación de aspecto
        if ($srcAspect > $destAspect) {
            // Imagen más ancha - ajustar por ancho
            $newWidth = self::AVATAR_WIDTH;
            $newHeight = (int)($newWidth / $srcAspect);
        } else {
            // Imagen más alta - ajustar por alto
            $newHeight = self::AVATAR_HEIGHT;
            $newWidth = (int)($newHeight * $srcAspect);
        }

        // Calcular posición para centrar la imagen en el canvas
        $destX = (int)((self::AVATAR_WIDTH - $newWidth) / 2);
        $destY = (int)((self::AVATAR_HEIGHT - $newHeight) / 2);

        return [
            'src_x' => 0,
            'src_y' => 0,
            'src_width' => $srcWidth,
            'src_height' => $srcHeight,
            'dest_x' => $destX,
            'dest_y' => $destY,
            'dest_width' => $newWidth,
            'dest_height' => $newHeight
        ];
    }

    /**
     * Guardar imagen procesada según tipo
     */
    private static function saveProcessedImage($image, string $path, string $mimeType): bool
    {
        switch ($mimeType) {
            case 'image/jpeg':
            case 'image/jpg':
                return imagejpeg($image, $path, self::AVATAR_QUALITY);
            case 'image/png':
                return imagepng($image, $path, 9);
            case 'image/gif':
                return imagegif($image, $path);
            case 'image/webp':
                return imagewebp($image, $path, self::AVATAR_QUALITY);
            default:
                return false;
        }
    }

    /**
     * Fallback a imagen original si el procesamiento falla
     */
    private static function fallbackToOriginal(string $sourcePath, string $destinationPath): bool
    {
        try {
            return copy($sourcePath, $destinationPath);
        } catch (Exception $e) {
            error_log("❌ Fallback también falló: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Procesar y redimensionar imagen para avatar - VERSIÓN CORREGIDA (SIN RECORTE)
     */
    private static function processAndResizeImage(string $sourcePath, string $destinationPath): bool
    {
        try {
            // Obtener información de la imagen
            $imageInfo = getimagesize($sourcePath);
            if (!$imageInfo) {
                throw new Exception('No se pudo leer la información de la imagen');
            }

            $mimeType = $imageInfo['mime'];
            $width = $imageInfo[0];
            $height = $imageInfo[1];

            // Crear imagen desde archivo según el tipo
            $sourceImage = self::createImageFromFile($sourcePath, $mimeType);
            if (!$sourceImage) {
                throw new Exception('No se pudo crear la imagen desde el archivo');
            }

            // Crear imagen de destino
            $destImage = imagecreatetruecolor(self::AVATAR_WIDTH, self::AVATAR_HEIGHT);
            if (!$destImage) {
                throw new Exception('No se pudo crear la imagen de destino');
            }

            // Configurar fondo según tipo de imagen
            self::setupImageBackground($destImage, $mimeType);

            // Calcular redimensionamiento manteniendo aspecto (SIN RECORTE)
            $resizeData = self::calculateResizeDimensions($width, $height);

            // Redimensionar manteniendo la imagen completa
            imagecopyresampled(
                $destImage, $sourceImage,
                $resizeData['dest_x'], $resizeData['dest_y'], // Posición en destino (centrada)
                $resizeData['src_x'], $resizeData['src_y'],   // Posición en origen (toda la imagen)
                $resizeData['dest_width'], $resizeData['dest_height'], // Dimensiones en destino
                $resizeData['src_width'], $resizeData['src_height']    // Dimensiones en origen (completas)
            );

            // Guardar imagen procesada
            $success = self::saveProcessedImage($destImage, $destinationPath, $mimeType);

            // Liberar memoria
            imagedestroy($sourceImage);
            imagedestroy($destImage);

            if (!$success) {
                throw new Exception('No se pudo guardar la imagen procesada');
            }

            return true;

        } catch (Exception $e) {
            error_log("❌ Error procesando imagen: " . $e->getMessage());
            return self::fallbackToOriginal($sourcePath, $destinationPath);
        }
    }

    /**
     * Convertir URL a ruta de archivo física
     */
    private static function urlToFilePath(string $url): string
    {
        // Remover el base path si está presente
        $relativePath = str_replace('/uploads/', '', $url);
        return self::UPLOAD_BASE_DIR . $relativePath;
    }

    /**
     * Verificar que la ruta está dentro del directorio de uploads permitido
     */
    private static function isInUploadsDirectory(string $filePath): bool
    {
        $uploadsBase = realpath(self::UPLOAD_BASE_DIR);
        $fileRealPath = realpath($filePath);

        if ($uploadsBase === false || $fileRealPath === false) {
            return false;
        }

        return strpos($fileRealPath, $uploadsBase) === 0;
    }

    /**
     * Obtener información del archivo
     */
    public static function getFileInfo(string $filePath): ?array
    {
        try {
            $physicalPath = self::urlToFilePath($filePath);

            if (!file_exists($physicalPath) || !self::isInUploadsDirectory($physicalPath)) {
                return null;
            }

            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mimeType = $finfo->file($physicalPath);

            return [
                'size' => filesize($physicalPath),
                'mime_type' => $mimeType,
                'last_modified' => filemtime($physicalPath),
                'exists' => true
            ];

        } catch (Exception $e) {
            error_log("❌ Error obteniendo información de archivo: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Validar tipo MIME contra tipos permitidos
     */
    public static function isValidMimeType(string $mimeType, string $category = 'image'): bool
    {
        switch ($category) {
            case 'image':
                return array_key_exists($mimeType, self::ALLOWED_IMAGE_TYPES);
            case 'document':
                $allowedDocuments = [
                    'application/pdf' => 'pdf',
                    'application/msword' => 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
                    'text/plain' => 'txt'
                ];
                return array_key_exists($mimeType, $allowedDocuments);
            default:
                return false;
        }
    }

    /**
     * Obtener tamaño máximo de archivo permitido
     */
    public static function getMaxFileSize(): int
    {
        return self::MAX_FILE_SIZE;
    }

    /**
     * Obtener tipos de imagen permitidos
     */
    public static function getAllowedImageTypes(): array
    {
        return array_keys(self::ALLOWED_IMAGE_TYPES);
    }

    /**
     * Obtener estadísticas de almacenamiento
     */
    public static function getStorageStats(): array
    {
        try {
            $stats = [
                'total_size' => 0,
                'avatar_files' => 0,
                'chat_files' => 0,
                'temp_files' => 0,
                'breakdown' => []
            ];

            // Calcular tamaño de avatares
            $avatarDir = self::UPLOAD_BASE_DIR . self::AVATAR_DIR;
            if (is_dir($avatarDir)) {
                $avatarStats = self::calculateDirectorySize($avatarDir);
                $stats['total_size'] += $avatarStats['size'];
                $stats['avatar_files'] += $avatarStats['files'];
                $stats['breakdown']['avatars'] = $avatarStats;
            }

            // Calcular tamaño de archivos de chat
            $chatFilesDir = self::UPLOAD_BASE_DIR . self::CHAT_FILES_DIR;
            if (is_dir($chatFilesDir)) {
                $chatStats = self::calculateDirectorySize($chatFilesDir);
                $stats['total_size'] += $chatStats['size'];
                $stats['chat_files'] += $chatStats['files'];
                $stats['breakdown']['chat_files'] = $chatStats;
            }

            // Calcular tamaño de archivos temporales
            $tempDir = self::UPLOAD_BASE_DIR . self::TEMP_DIR;
            if (is_dir($tempDir)) {
                $tempStats = self::calculateDirectorySize($tempDir);
                $stats['total_size'] += $tempStats['size'];
                $stats['temp_files'] += $tempStats['files'];
                $stats['breakdown']['temp_files'] = $tempStats;
            }

            return $stats;

        } catch (Exception $e) {
            error_log("❌ Error obteniendo estadísticas de almacenamiento: " . $e->getMessage());
            return [
                'total_size' => 0,
                'avatar_files' => 0,
                'chat_files' => 0,
                'temp_files' => 0,
                'breakdown' => []
            ];
        }
    }

    /**
     * Calcular tamaño y cantidad de archivos en un directorio recursivamente
     */
    private static function calculateDirectorySize(string $dir): array
    {
        $size = 0;
        $files = 0;

        if (!is_dir($dir)) {
            return ['size' => 0, 'files' => 0];
        }

        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($items as $item) {
            if ($item->isFile()) {
                $size += $item->getSize();
                $files++;
            }
        }

        return ['size' => $size, 'files' => $files];
    }

    /**
     * Inicializar servicio - crear directorios necesarios
     */
    public static function initialize(): void
    {
        try {
            $directories = [
                self::UPLOAD_BASE_DIR,
                self::UPLOAD_BASE_DIR . self::AVATAR_DIR,
                self::UPLOAD_BASE_DIR . self::CHAT_FILES_DIR,
                self::UPLOAD_BASE_DIR . self::TEMP_DIR
            ];

            foreach ($directories as $directory) {
                self::ensureDirectoryExists($directory);
            }

            error_log("✅ Servicio de upload de archivos inicializado correctamente");

        } catch (Exception $e) {
            error_log("❌ Error inicializando servicio de upload: " . $e->getMessage());
        }
    }
}

// Inicializar el servicio al cargar el archivo
FileUploadService::initialize();
