<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administración - Fox-IA</title>
    <meta name="description" content="Panel de administración para gestionar usuarios, configuraciones y sistema Fox-IA">

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">

    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <!-- Styles -->
    <link rel="stylesheet" href="style.css">
</head>
<body class="antialiased">
    <!-- Aplicación de Administración -->
    <div id="admin-app" class="hidden">
        <!-- El contenido se genera dinámicamente en admin.js -->
    </div>

    <!-- Mensaje de Autenticación -->
    <div id="auth-message" class="min-h-screen flex items-center justify-center bg-gray-900">
        <div class="text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 class="text-xl font-semibold text-white mb-2">Verificando Acceso...</h2>
            <p class="text-gray-400">Verificando permisos de administrador</p>
        </div>
    </div>

    <!-- Scripts -->
    <script src="admin.js"></script>

    <!-- Estilos adicionales -->
    <style>
        /* Estilos para notificaciones */
        .admin-notification {
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        /* Efectos hover mejorados */
        .hover-lift:hover {
            transform: translateY(-2px);
            transition: all 0.2s ease-in-out;
        }

        /* Estados de carga */
        .loading-skeleton {
            background: linear-gradient(90deg, var(--gray-700) 25%, var(--gray-600) 50%, var(--gray-700) 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
        }

        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .mobile-stack {
                flex-direction: column;
            }

            .mobile-full {
                width: 100%;
            }
        }
    </style>
</body>
</html>
