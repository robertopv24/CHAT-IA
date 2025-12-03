<?php
// src/services/PHPMailerService.php

namespace Foxia\Services;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use Psr\Log\LoggerInterface;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Foxia\Services\ConfigService;

class PHPMailerService
{
    private static ?LoggerInterface $logger = null;

    public static function sendVerificationEmail(string $toEmail, string $verificationLink): bool
    {
        // Inicializar logger si no existe
        if (self::$logger === null) {
            self::$logger = new Logger('mailer');
            self::$logger->pushHandler(new StreamHandler(__DIR__ . '/../../logs/mailer.log', Logger::ERROR));
        }

        try {
            $mail = new PHPMailer(true);

            // Configuración del servidor SMTP
            $mail->isSMTP();
            $mail->Host = ConfigService::get('SMTP_HOST') ?? 'smtp.gmail.com';
            $mail->SMTPAuth = true;
            $mail->Username = ConfigService::get('SMTP_USER') ?? '';
            $mail->Password = ConfigService::get('SMTP_PASSWORD') ?? '';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = ConfigService::get('SMTP_PORT') ?? 587;

            // Configuración del remitente y destinatario
            $mail->setFrom('no-reply@foxia.com', 'Fox-IA');
            $mail->addAddress($toEmail);

            // Contenido del email
            $mail->isHTML(true);
            $mail->Subject = 'Verifica tu cuenta de Fox-IA';

            $mail->Body = self::getEmailTemplate($verificationLink);
            $mail->AltBody = "Por favor verifica tu cuenta de Fox-IA haciendo clic en el siguiente enlace: $verificationLink";

            $mail->send();
            return true;

        } catch (Exception $e) {
            self::$logger->error('Error al enviar email de verificación: ' . $e->getMessage(), [
                'to' => $toEmail,
                'error' => $mail->ErrorInfo ?? 'Unknown error'
            ]);
            return false;
        }
    }

    private static function getEmailTemplate(string $verificationLink): string
    {


        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Verifica tu cuenta de Fox-IA</h2>
        <p>¡Gracias por registrarte en Fox-IA! Para completar tu registro, por favor verifica tu dirección de email.</p>

        <a href="$verificationLink" class="button">Verificar mi cuenta</a>


        <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
        <p><a href="$verificationLink">$verificationLink</a></p>

        <div class="footer">
            <p>Este es un mensaje automático, por favor no respondas a este email.</p>
            <p>&copy; " . 2025 . " Fox-IA. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
HTML;
    }
}
