-- phpMyAdmin SQL Dump
-- version 5.2.2-1.fc42
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost
-- Tiempo de generación: 06-11-2025 a las 10:38:16
-- Versión del servidor: 10.11.11-MariaDB
-- Versión de PHP: 8.4.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `foxia`
--

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `CleanupExpiredContextTriplets` ()   BEGIN
    DELETE FROM chat_context_triplets
    WHERE expires_at < NOW() OR created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `GetSystemStats` ()   BEGIN
    SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as active_users,
        (SELECT COUNT(*) FROM chats) as total_chats,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM global_knowledge_triplets) as total_global_triplets,
        (SELECT COUNT(*) FROM global_knowledge_triplets WHERE is_verified = TRUE) as verified_global_triplets,
        (SELECT COUNT(*) FROM chat_context_triplets) as total_context_triplets;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `SearchKnowledge` (IN `search_query` VARCHAR(500), IN `max_results` INT)   BEGIN
    DECLARE total_limit INT DEFAULT 0;

    CREATE TEMPORARY TABLE IF NOT EXISTS temp_search_results (
        source VARCHAR(10),
        id INT,
        subject VARCHAR(500),
        predicate VARCHAR(500),
        object VARCHAR(500),
        category VARCHAR(100),
        description TEXT,
        confidence_score FLOAT,
        created_at TIMESTAMP,
        result_order INT
    );

    TRUNCATE TABLE temp_search_results;

    INSERT INTO temp_search_results
    SELECT
        'global' as source,
        id,
        subject,
        predicate,
        object,
        category,
        description,
        1.0 as confidence_score,
        created_at,
        1 as result_order
    FROM global_knowledge_triplets
    WHERE is_active = TRUE
    AND (MATCH(subject, predicate, object, description) AGAINST(search_query IN NATURAL LANGUAGE MODE)
         OR subject LIKE CONCAT('%', search_query, '%')
         OR predicate LIKE CONCAT('%', search_query, '%')
         OR object LIKE CONCAT('%', search_query, '%'))
    ORDER BY is_verified DESC, 1.0 DESC
    LIMIT max_results;

    INSERT INTO temp_search_results
    SELECT
        'context' as source,
        id,
        subject,
        predicate,
        object,
        NULL as category,
        NULL as description,
        confidence_score,
        created_at,
        2 as result_order
    FROM chat_context_triplets
    WHERE (MATCH(subject, predicate, object) AGAINST(search_query IN NATURAL LANGUAGE MODE)
         OR subject LIKE CONCAT('%', search_query, '%')
         OR predicate LIKE CONCAT('%', search_query, '%')
         OR object LIKE CONCAT('%', search_query, '%'))
    AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY confidence_score DESC, created_at DESC
    LIMIT max_results;

    SET total_limit = max_results * 2;

    SELECT
        source,
        id,
        subject,
        predicate,
        object,
        category,
        description,
        confidence_score,
        created_at
    FROM temp_search_results
    ORDER BY result_order, confidence_score DESC
    LIMIT total_limit;

    DROP TEMPORARY TABLE IF EXISTS temp_search_results;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ai_nodes`
--

CREATE TABLE `ai_nodes` (
  `id` int(11) NOT NULL,
  `node_url` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_health_check` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `chats`
--

CREATE TABLE `chats` (
  `id` int(11) NOT NULL,
  `uuid` char(36) NOT NULL,
  `chat_type` enum('ai','user_to_user') NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_message_at` timestamp NULL DEFAULT NULL,
  `is_group` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `chats`
--

INSERT INTO `chats` (`id`, `uuid`, `chat_type`, `title`, `created_by`, `created_at`, `updated_at`, `last_message_at`, `is_group`) VALUES
(23, '74dd4c2a-a7cd-4a6c-a6e2-02587984b463', 'user_to_user', 'Chat con admin', 3, '2025-09-21 01:52:05', '2025-09-21 01:52:05', NULL, 0),
(24, 'faa1f371-d15c-4bcf-9a83-fff739b6a9c9', 'user_to_user', 'Chat con antares', 3, '2025-09-21 01:52:10', '2025-10-02 15:15:25', '2025-10-02 15:15:25', 0),
(28, 'da6386d2-46af-48c5-b78a-d825ab6837ee', 'user_to_user', 'Chat con admin', 8, '2025-09-22 19:07:58', '2025-10-02 11:37:06', '2025-10-02 11:37:06', 0),
(34, '5cb07f2f-20d2-4c17-aec8-4a03d1e179b6', 'user_to_user', 'Chat con Riberto', 2, '2025-10-04 07:18:44', '2025-10-07 04:50:02', '2025-10-07 04:50:02', 0),
(36, '70e16a16-2468-4710-90af-672f2f1007e8', 'ai', 'Nuevo Chat con IA', 2, '2025-10-07 10:15:02', '2025-10-07 12:07:46', '2025-10-07 12:07:46', 0),
(37, '4cd13835-ee58-4060-874e-63f21967f69a', 'user_to_user', 'Chat con roberto', 2, '2025-10-07 22:20:47', '2025-10-07 22:22:43', '2025-10-07 22:22:43', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `chat_context_triplets`
--

CREATE TABLE `chat_context_triplets` (
  `id` int(11) NOT NULL,
  `chat_id` int(11) NOT NULL,
  `message_id` int(11) DEFAULT NULL,
  `subject` varchar(500) NOT NULL,
  `predicate` varchar(500) NOT NULL,
  `object` varchar(500) NOT NULL,
  `confidence_score` float DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `chat_participants`
--

CREATE TABLE `chat_participants` (
  `id` int(11) NOT NULL,
  `chat_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `joined_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_admin` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `chat_participants`
--

INSERT INTO `chat_participants` (`id`, `chat_id`, `user_id`, `joined_at`, `is_admin`) VALUES
(30, 23, 3, '2025-09-21 01:52:05', 1),
(31, 23, 1, '2025-09-21 01:52:05', 0),
(32, 24, 3, '2025-09-21 01:52:10', 1),
(33, 24, 2, '2025-09-21 01:52:10', 0),
(40, 28, 8, '2025-09-22 19:07:58', 1),
(41, 28, 1, '2025-09-22 19:07:58', 0),
(48, 34, 2, '2025-10-04 07:18:44', 1),
(49, 34, 8, '2025-10-04 07:18:44', 0),
(52, 36, 2, '2025-10-07 10:15:02', 1),
(53, 37, 2, '2025-10-07 22:20:47', 1),
(54, 37, 11, '2025-10-07 22:20:47', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `email_verifications`
--

CREATE TABLE `email_verifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `verification_token` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `email_verifications`
--

INSERT INTO `email_verifications` (`id`, `user_id`, `verification_token`, `created_at`, `expires_at`) VALUES
(9, 1, '692d1ebebc04a47db1717df6eb144af03159b44c5c4da36eddbbcfcabce68262', '2025-09-19 06:12:56', '2025-09-20 08:12:56'),
(10, 1, '947230afe3ab7b5c84164058c32c12cf33c432b2b9d2b9d6691e8902941e78c9', '2025-09-19 06:19:20', '2025-09-20 08:19:20'),
(13, 3, '206fa0d9794d796856d21f1cef12f3bf63cd3867b50b0d67c1694b2ef661aedb', '2025-09-21 01:48:50', '2025-09-22 03:48:50');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `global_knowledge_history`
--

CREATE TABLE `global_knowledge_history` (
  `id` int(11) NOT NULL,
  `triplet_id` int(11) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `predicate` varchar(500) NOT NULL,
  `object` varchar(500) NOT NULL,
  `changed_by` int(11) NOT NULL,
  `change_type` enum('CREATE','UPDATE','DELETE','VERIFY') NOT NULL,
  `change_description` text DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `global_knowledge_suggestions`
--

CREATE TABLE `global_knowledge_suggestions` (
  `id` int(11) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `predicate` varchar(500) NOT NULL,
  `object` varchar(500) NOT NULL,
  `source_chat_id` int(11) DEFAULT NULL,
  `source_message_id` int(11) DEFAULT NULL,
  `suggested_by` int(11) NOT NULL,
  `suggested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `suggestion_reason` text DEFAULT NULL,
  `confidence_score` float DEFAULT 0.8,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `global_knowledge_triplets`
--

CREATE TABLE `global_knowledge_triplets` (
  `id` int(11) NOT NULL,
  `subject` varchar(500) NOT NULL,
  `predicate` varchar(500) NOT NULL,
  `object` varchar(500) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `is_verified` tinyint(1) DEFAULT 0,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `version` int(11) DEFAULT 1,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `global_knowledge_triplets`
--

INSERT INTO `global_knowledge_triplets` (`id`, `subject`, `predicate`, `object`, `category`, `description`, `is_active`, `is_verified`, `verified_by`, `verified_at`, `created_by`, `created_at`, `updated_at`, `version`, `metadata`) VALUES
(1, 'Fox-IA', 'es', 'un entorno asistido por inteligencia artificial', 'Información General', 'Definición básica de Fox-IA', 1, 1, NULL, NULL, NULL, '2025-09-16 09:32:03', '2025-09-16 09:32:03', 1, NULL),
(2, 'PHP', 'es', 'un lenguaje de programación de código abierto', 'Tecnología', 'Lenguaje usado en el backend de Fox-IA', 1, 1, NULL, NULL, NULL, '2025-09-16 09:32:03', '2025-09-16 09:32:03', 1, NULL),
(3, 'MySQL', 'es', 'un sistema de gestión de bases de datos relacional', 'Tecnología', 'Base de datos utilizada por Fox-IA', 1, 1, NULL, NULL, NULL, '2025-09-16 09:32:03', '2025-09-16 09:32:03', 1, NULL),
(4, 'Inteligencia Artificial', 'se define como', 'la simulación de procesos de inteligencia humana por máquinas', 'Ciencia', 'Definición básica de IA', 1, 1, NULL, NULL, NULL, '2025-09-16 09:32:03', '2025-09-16 09:32:03', 1, NULL);

--
-- Disparadores `global_knowledge_triplets`
--
DELIMITER $$
CREATE TRIGGER `AfterGlobalKnowledgeDelete` AFTER DELETE ON `global_knowledge_triplets` FOR EACH ROW BEGIN
    INSERT INTO global_knowledge_history (triplet_id, subject, predicate, object, changed_by, change_type)
    VALUES (OLD.id, OLD.subject, OLD.predicate, OLD.object, OLD.verified_by, 'DELETE');
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `AfterGlobalKnowledgeInsert` AFTER INSERT ON `global_knowledge_triplets` FOR EACH ROW BEGIN
    INSERT INTO global_knowledge_history (triplet_id, subject, predicate, object, changed_by, change_type)
    VALUES (NEW.id, NEW.subject, NEW.predicate, NEW.object, NEW.created_by, 'CREATE');
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `AfterGlobalKnowledgeUpdate` AFTER UPDATE ON `global_knowledge_triplets` FOR EACH ROW BEGIN
    IF NEW.verified_by IS NOT NULL THEN
        INSERT INTO global_knowledge_history (triplet_id, subject, predicate, object, changed_by, change_type, change_description)
        VALUES (NEW.id, NEW.subject, NEW.predicate, NEW.object, NEW.verified_by, 'UPDATE', 'Verificación o actualización');
    ELSE
        INSERT INTO global_knowledge_history (triplet_id, subject, predicate, object, changed_by, change_type)
        VALUES (NEW.id, NEW.subject, NEW.predicate, NEW.object, OLD.created_by, 'UPDATE');
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `knowledge_categories`
--

CREATE TABLE `knowledge_categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `uuid` char(36) NOT NULL,
  `chat_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `replying_to_id` int(11) DEFAULT NULL,
  `content` text NOT NULL,
  `message_type` enum('text','image','file','system') DEFAULT 'text',
  `ai_model` varchar(50) DEFAULT NULL,
  `tokens_used` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `messages`
--

INSERT INTO `messages` (`id`, `uuid`, `chat_id`, `user_id`, `replying_to_id`, `content`, `message_type`, `ai_model`, `tokens_used`, `created_at`, `updated_at`, `deleted`) VALUES
(43, 'e5436f5e-2536-43e4-ab6e-c3766ec5c9b9', 28, 8, NULL, 'hodsk', 'text', NULL, NULL, '2025-09-22 19:10:30', '2025-09-22 19:15:13', 1),
(44, '0465c057-60fe-4ad2-baa2-db78c3593fe2', 28, 1, 43, 'asdasd', 'text', NULL, NULL, '2025-09-22 19:10:51', '2025-09-22 19:10:51', 0),
(45, '3dda5f69-265f-462a-a854-aebec9b3aa37', 28, 1, NULL, 'dfshjdfhksj', 'text', NULL, NULL, '2025-09-22 19:11:41', '2025-09-22 19:15:20', 1),
(56, 'a61d5ef7-5cf1-4eda-ae71-701db2f684c9', 28, 1, NULL, 'asdasd', 'text', NULL, NULL, '2025-10-02 11:37:06', '2025-10-02 11:37:06', 0),
(64, '7663f09c-2208-4040-81c8-0d8c8ef23d83', 24, 2, NULL, 'Jdjdjd', 'text', NULL, NULL, '2025-10-02 15:10:11', '2025-10-02 15:10:11', 0),
(65, 'a384aeb6-9ad6-4643-a564-88f64d3b9729', 24, 2, NULL, '😗☺️☺️😘🤦🏻😘🤦🏻', 'text', NULL, NULL, '2025-10-02 15:14:02', '2025-10-02 15:14:02', 0),
(66, '01affca8-99bb-4325-85a4-5a961bd508ac', 24, 2, NULL, 'Fjdjdj', 'text', NULL, NULL, '2025-10-02 15:15:25', '2025-10-02 15:15:25', 0),
(92, '4a0efd74-25a8-42b7-8e34-545a55a361a8', 34, 2, NULL, 'a', 'text', NULL, NULL, '2025-10-04 07:43:30', '2025-10-04 07:43:30', 0),
(93, 'ec276622-37d0-4b5e-b153-09ea4cd2cadf', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759577329_3a45664afd6cc64b.png\",\"original_name\":\"Avatar-PNG-Image-File.png\",\"file_size\":68613,\"mime_type\":\"image\\/png\",\"upload_token\":\"41baf5ea5f55a73d6ad2623cafbb68ba\"}', 'image', NULL, NULL, '2025-10-04 11:28:49', '2025-10-04 11:28:49', 0),
(94, '8fb50d9c-d2fb-4dfa-8d5c-e7fb92436b88', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759577330_a53ca86ec242baa5.png\",\"original_name\":\"Avatar-PNG-Image-File.png\",\"file_size\":68613,\"mime_type\":\"image\\/png\",\"upload_token\":\"2c73b2c39d62e4cfb5d6c7241dd662a3\"}', 'image', NULL, NULL, '2025-10-04 11:28:50', '2025-10-04 11:28:50', 0),
(98, '914fa0f9-a4d2-4794-8b05-c29815fe4ae4', 34, 2, NULL, 'Dkdjjdj', 'text', NULL, NULL, '2025-10-04 20:26:13', '2025-10-04 20:26:13', 0),
(99, '272583c5-b160-408b-b743-326ecfed108e', 34, 2, 94, 'Jfjfjdj', 'text', NULL, NULL, '2025-10-04 20:26:24', '2025-10-04 20:26:24', 0),
(100, '73a9c16a-42ab-46c6-98b9-138d872fb42c', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759712511_4fe8db03dc8f23f1.docx\",\"original_name\":\"proyecto fox-ia.docx\",\"file_size\":21452,\"mime_type\":\"application\\/vnd.openxmlformats-officedocument.wordprocessingml.document\",\"upload_token\":\"ba9d3627eac07f5fb74b8a112a5a329e\"}', 'file', NULL, NULL, '2025-10-06 01:01:51', '2025-10-06 01:01:51', 0),
(101, 'a460745b-7c64-4ddd-9881-431892f8ad55', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759712511_b7d86d5172f2e56d.docx\",\"original_name\":\"proyecto fox-ia.docx\",\"file_size\":21452,\"mime_type\":\"application\\/vnd.openxmlformats-officedocument.wordprocessingml.document\",\"upload_token\":\"31e032967e24e5e71ff54a03dee63a3f\"}', 'file', NULL, NULL, '2025-10-06 01:01:51', '2025-10-06 01:01:51', 0),
(102, '569e468d-9483-480b-b041-7303eabc45a7', 34, 2, 101, 'asda', 'text', NULL, NULL, '2025-10-06 01:02:03', '2025-10-06 01:02:03', 0),
(110, '5da10af5-a7cf-44be-8a22-5dfbdcf60b7c', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759812601_b70ce0e3a0c4f97a.jpg\",\"original_name\":\"Avatar-PNG-Image-File.jpg\",\"file_size\":68613,\"mime_type\":\"image\\/jpeg\",\"upload_token\":\"c4ca238a540ebf4b6c16c0ef79877803\"}', 'image', NULL, NULL, '2025-10-07 04:50:01', '2025-10-07 04:50:01', 0),
(111, 'a51a932e-5156-444f-97fc-902742b3018d', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759812601_bf5eff96e2213066.docx\",\"original_name\":\"proyecto fox-ia.docx\",\"file_size\":21452,\"mime_type\":\"application\\/vnd.openxmlformats-officedocument.wordprocessingml.document\",\"upload_token\":\"c4fe096561d1aab4d81b537f14f4dd85\"}', 'file', NULL, NULL, '2025-10-07 04:50:01', '2025-10-07 04:50:01', 0),
(112, 'c7b5291f-b8c4-4cff-9924-fdcb32d1d512', 34, 2, NULL, '{\"file_url\":\"\\/uploads\\/chat_files\\/5cb07f2f-20d2-4c17-aec8-4a03d1e179b6\\/2887ca69-953b-11f0-8d1d-dbc85a66f495\\/file_1759812602_11d14d0c40b417bb.jpg\",\"original_name\":\"Avatar-PNG-Image-File.jpg\",\"file_size\":68613,\"mime_type\":\"image\\/jpeg\",\"upload_token\":\"af270315d06108f7d26ed4aa8f7fc95c\"}', 'image', NULL, NULL, '2025-10-07 04:50:02', '2025-10-07 04:50:02', 0),
(121, 'a1c2ff2a-5d1f-4f8c-831f-bb5945c8c3a0', 36, 2, NULL, 'asda', 'text', NULL, NULL, '2025-10-07 12:07:46', '2025-10-07 12:07:46', 0),
(129, '0cd2e906-1055-4ee3-904f-9ffb7d81696a', 37, 2, NULL, 'sion', 'text', NULL, NULL, '2025-10-07 22:20:52', '2025-10-07 22:20:52', 0),
(130, 'd339255d-10d5-44d5-9db4-380204212caf', 37, 2, NULL, 'si', 'text', NULL, NULL, '2025-10-07 22:21:26', '2025-10-07 22:21:26', 0),
(131, '9975f0dd-a41b-47ff-9f3c-dcc5e6300cb8', 37, 11, NULL, 'a', 'text', NULL, NULL, '2025-10-07 22:22:43', '2025-10-07 22:22:43', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `related_chat_id` int(11) DEFAULT NULL,
  `related_message_id` int(11) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `content`, `related_chat_id`, `related_message_id`, `is_read`, `created_at`, `expires_at`) VALUES
(1, 2, 'new_message', 'Nuevo mensaje de admin', 'buen ?', NULL, NULL, 1, '2025-09-21 01:07:25', NULL),
(2, 1, 'new_message', 'Nuevo mensaje de antares', 'bien', NULL, NULL, 1, '2025-09-21 01:17:32', NULL),
(3, 2, 'new_message', 'Nuevo mensaje de admin', 'claro que si', NULL, NULL, 1, '2025-09-21 01:22:06', NULL),
(4, 2, 'new_message', 'Nuevo mensaje de admin', 'y tu ?', NULL, NULL, 1, '2025-09-21 01:22:12', NULL),
(5, 2, 'new_message', 'Nuevo mensaje de admin', 'como estas', NULL, NULL, 1, '2025-09-21 01:22:16', NULL),
(6, 1, 'new_message', 'Nuevo mensaje de antares', 'bien y tu?', NULL, NULL, 1, '2025-09-21 01:45:13', NULL),
(7, 1, 'new_message', 'Nuevo mensaje de antares', 'asdasd', NULL, NULL, 1, '2025-09-21 02:51:26', NULL),
(8, 1, 'new_message', 'Nuevo mensaje de antares', 'asdasd', NULL, NULL, 1, '2025-09-21 02:51:29', NULL),
(9, 1, 'new_message', 'Nuevo mensaje de antares', 'asdasd', NULL, NULL, 1, '2025-09-21 02:51:30', NULL),
(10, 2, 'new_message', 'Nuevo mensaje de admin', 'asdasd', NULL, NULL, 1, '2025-09-21 03:29:42', NULL),
(11, 2, 'new_message', 'Nuevo mensaje de admin', '😆🤣', NULL, NULL, 1, '2025-09-21 05:35:37', NULL),
(12, 2, 'new_message', 'Nuevo mensaje de admin', 'hola', NULL, NULL, 1, '2025-09-21 06:10:27', NULL),
(13, 2, 'new_message', 'Nuevo mensaje de admin', 'asd', NULL, NULL, 1, '2025-09-21 09:18:04', NULL),
(14, 2, 'new_message', 'Nuevo mensaje de admin', 'asd', NULL, NULL, 1, '2025-09-21 09:18:28', NULL),
(15, 2, 'new_message', 'Nuevo mensaje de admin', 'sad', NULL, NULL, 1, '2025-09-21 09:27:38', NULL),
(16, 2, 'new_message', 'Nuevo mensaje de admin', 'sdf', NULL, NULL, 1, '2025-09-21 09:28:40', NULL),
(17, 2, 'new_message', 'Nuevo mensaje de admin', 'asdasd', NULL, NULL, 1, '2025-09-21 09:36:27', NULL),
(18, 2, 'new_message', 'Nuevo mensaje de admin', 'asdasd', NULL, NULL, 1, '2025-09-21 09:36:33', NULL),
(19, 2, 'new_message', 'Nuevo mensaje de admin', 'asdw', NULL, NULL, 1, '2025-09-21 19:42:09', NULL),
(20, 2, 'new_message', 'Nuevo mensaje de admin', 'hola', NULL, NULL, 1, '2025-09-21 19:53:06', NULL),
(21, 2, 'new_message', 'Nuevo mensaje de admin', 'que tal', NULL, NULL, 1, '2025-09-21 19:53:09', NULL),
(22, 2, 'new_message', 'Nuevo mensaje de admin', 'como estas', NULL, NULL, 1, '2025-09-21 19:53:12', NULL),
(23, 2, 'new_message', 'Nuevo mensaje de admin', 'bien y tu', NULL, NULL, 1, '2025-09-21 19:53:21', NULL),
(24, 2, 'new_message', 'Nuevo mensaje de admin', 'hola', NULL, NULL, 1, '2025-09-21 19:54:54', NULL),
(25, 2, 'new_message', 'Nuevo mensaje de admin', 'bien', NULL, NULL, 1, '2025-09-21 19:55:55', NULL),
(26, 2, 'new_message', 'Nuevo mensaje de admin', 'zasdasd', NULL, NULL, 1, '2025-09-21 22:24:26', NULL),
(27, 2, 'new_message', 'Nuevo mensaje de admin', '😃☺️🐒🦍🦝🐱🦄🐷🥔🍆🗻🎟️🇻🇪🔷', NULL, NULL, 1, '2025-09-21 22:26:20', NULL),
(28, 2, 'new_message', 'Nuevo mensaje de admin', 'asd', NULL, NULL, 1, '2025-09-22 18:36:32', NULL),
(29, 1, 'new_message', 'Nuevo mensaje de Riberto', 'hodsk', 28, NULL, 1, '2025-09-22 19:10:31', NULL),
(30, 8, 'new_message', 'Nuevo mensaje de admin', 'asdasd', 28, NULL, 1, '2025-09-22 19:10:51', NULL),
(31, 8, 'new_message', 'Nuevo mensaje de admin', 'dfshjdfhksj', 28, NULL, 1, '2025-09-22 19:11:41', NULL),
(32, 1, 'new_message', 'Nuevo mensaje de antares', 'xd', NULL, NULL, 1, '2025-09-22 20:09:02', NULL),
(33, 1, 'new_message', 'Nuevo mensaje de antares', 'XD', NULL, NULL, 1, '2025-09-22 20:09:12', NULL),
(34, 1, 'new_message', '💬 antares en Chat con antares', 'asasd', NULL, NULL, 1, '2025-10-01 16:13:04', NULL),
(35, 1, 'reply', '📨 antares respondió en Chat con antares', 'asdas', NULL, NULL, 1, '2025-10-01 16:13:40', NULL),
(36, 1, 'new_message', '💬 antares en Chat con antares', 'sas', NULL, NULL, 1, '2025-10-02 11:33:59', NULL),
(37, 8, 'new_message', '💬 admin en Chat con admin', 'asdasd', 28, NULL, 0, '2025-10-02 11:37:06', NULL),
(38, 2, 'new_message', '💬 admin en Chat con antares', 'asdasd', NULL, NULL, 1, '2025-10-02 11:37:13', NULL),
(39, 2, 'reply', '📨 admin respondió en Chat con antares', 'asdasd', NULL, NULL, 1, '2025-10-02 11:37:18', NULL),
(40, 2, 'new_message', '💬 admin en Chat con antares', 'asdasd', NULL, NULL, 1, '2025-10-02 11:46:27', NULL),
(41, 1, 'new_message', '💬 antares en Chat con antares', 'asdasd', NULL, NULL, 1, '2025-10-02 11:55:35', NULL),
(42, 1, 'new_message', '💬 antares en Chat con antares', 'asda', NULL, NULL, 1, '2025-10-02 13:26:10', NULL),
(43, 3, 'new_message', '💬 antares en Chat con antares', 'Jdjdjd', 24, NULL, 0, '2025-10-02 15:10:11', NULL),
(44, 3, 'new_message', '💬 antares en Chat con antares', '😗☺️☺️😘🤦🏻😘🤦🏻', 24, NULL, 0, '2025-10-02 15:14:02', NULL),
(45, 3, 'new_message', '💬 antares en Chat con antares', 'Fjdjdj', 24, NULL, 0, '2025-10-02 15:15:25', NULL),
(46, 2, 'new_message', '💬 robertopv1988 en Chat con antares', 'Jdjdndjkeke', NULL, NULL, 1, '2025-10-02 15:20:17', NULL),
(50, 1, 'new_message', '💬 antares en Chat con antares', 'Fhhgjhj', NULL, NULL, 1, '2025-10-02 19:46:01', NULL),
(51, 2, 'new_message', '💬 admin en Chat con antares', 'hola', NULL, NULL, 1, '2025-10-03 00:32:03', NULL),
(52, 1, 'reply', '📨 antares respondió en Chat con antares', 'q tal', NULL, NULL, 1, '2025-10-03 00:32:53', NULL),
(53, 2, 'reply', '📨 admin respondió en Chat con antares', 'bien', NULL, NULL, 1, '2025-10-03 00:33:39', NULL),
(54, 2, 'new_message', '💬 admin en Chat con antares', 'hsdgjhd', NULL, NULL, 1, '2025-10-03 00:35:16', NULL),
(55, 2, 'new_message', '💬 admin en Chat con antares', 'sdfsdf', NULL, NULL, 1, '2025-10-03 00:35:17', NULL),
(56, 1, 'new_message', '💬 antares en Chat con antares', 'asdaskd', NULL, NULL, 1, '2025-10-03 00:43:28', NULL),
(57, 1, 'reply', '📨 antares respondió en Chat con antares', 'hsdgjhd', NULL, NULL, 1, '2025-10-03 00:46:15', NULL),
(58, 1, 'new_message', '💬 antares en Chat con antares', '🤪sdfgsd', NULL, NULL, 1, '2025-10-03 00:46:57', NULL),
(59, 1, 'new_message', '💬 antares en Chat con antares', 'Fjdbhdjf', NULL, NULL, 1, '2025-10-03 03:53:03', NULL),
(60, 1, 'new_message', '💬 antares en Chat con antares', 'Asd', NULL, NULL, 1, '2025-10-03 03:53:11', NULL),
(61, 2, 'reply', '📨 admin respondió en Chat con antares', 'ghgjh', NULL, NULL, 1, '2025-10-03 03:54:05', NULL),
(62, 1, 'reply', '📨 antares respondió en Chat con antares', 'Jdjdjjddk', NULL, NULL, 1, '2025-10-03 03:55:02', NULL),
(63, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjhfkd', NULL, NULL, 1, '2025-10-03 03:55:59', NULL),
(64, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjrjr', NULL, NULL, 1, '2025-10-03 03:56:42', NULL),
(65, 1, 'new_message', '💬 antares en Chat con antares', 'Hdjdhdh', NULL, NULL, 1, '2025-10-03 03:56:47', NULL),
(66, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjhfjd', NULL, NULL, 1, '2025-10-03 03:57:04', NULL),
(67, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjdjjdjdjd', NULL, NULL, 1, '2025-10-03 03:57:06', NULL),
(68, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjdjjdjddj', NULL, NULL, 1, '2025-10-03 03:57:09', NULL),
(69, 2, 'reply', '📨 admin respondió en Chat con antares', 'ytrytryt', NULL, NULL, 1, '2025-10-03 03:58:01', NULL),
(70, 1, 'reply', '📨 antares respondió en Chat con antares', 'Jdjfjfj', NULL, NULL, 1, '2025-10-03 03:59:46', NULL),
(71, 8, 'new_message', '💬 antares en Chat con Riberto', 'a', 34, NULL, 0, '2025-10-04 07:43:30', NULL),
(72, 8, 'new_message', '💬 antares en Chat con Riberto', '🖼️ Imagen: Avatar-PNG-Image-File.png', 34, NULL, 0, '2025-10-04 11:28:49', NULL),
(73, 8, 'new_message', '💬 antares en Chat con Riberto', '🖼️ Imagen: Avatar-PNG-Image-File.png', 34, NULL, 0, '2025-10-04 11:28:50', NULL),
(74, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjfjjdjddkdkd', NULL, NULL, 1, '2025-10-04 20:23:37', NULL),
(75, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjdjdjdj fjdjjdjdjckfb', NULL, NULL, 1, '2025-10-04 20:24:14', NULL),
(76, 1, 'new_message', '💬 antares en Chat con antares', 'Jdjfjjfjfjd', NULL, NULL, 1, '2025-10-04 20:24:25', NULL),
(77, 8, 'new_message', '💬 antares en Chat con Riberto', 'Dkdjjdj', 34, NULL, 0, '2025-10-04 20:26:13', NULL),
(78, 8, 'self_reply', '↩️ antares respondió a su mensaje en Chat con Riberto', 'Jfjfjdj', 34, NULL, 0, '2025-10-04 20:26:24', NULL),
(79, 8, 'new_message', '💬 antares en Chat con Riberto', '📎 Archivo: proyecto fox-ia.docx', 34, NULL, 0, '2025-10-06 01:01:51', NULL),
(80, 8, 'new_message', '💬 antares en Chat con Riberto', '📎 Archivo: proyecto fox-ia.docx', 34, NULL, 0, '2025-10-06 01:01:51', NULL),
(81, 8, 'self_reply', '↩️ antares respondió a su mensaje en Chat con Riberto', 'asda', 34, NULL, 0, '2025-10-06 01:02:03', NULL),
(82, 1, 'new_message', '💬 antares en Chat con antares', 'wenas', NULL, NULL, 1, '2025-10-06 02:29:56', NULL),
(83, 1, 'new_message', '💬 antares en Chat con antares', '1. Antecedentes de la República de Venezuela\nVenezuela formó parte de la Gran Colombia (junto a Nu...', NULL, NULL, 1, '2025-10-06 02:33:01', NULL),
(84, 1, 'new_message', '💬 antares en Chat con antares', 'hello', NULL, NULL, 1, '2025-10-06 02:33:08', NULL),
(85, 1, 'self_reply', '↩️ antares respondió a su mensaje en Chat con antares', 'hay esta', NULL, NULL, 1, '2025-10-06 02:33:27', NULL),
(86, 1, 'new_message', '💬 antares en Chat con antares', 'hola', NULL, NULL, 1, '2025-10-07 00:52:21', NULL),
(87, 1, 'new_message', '💬 antares en Chat con antares', '🖼️ Imagen: Avatar-PNG-Image-File.jpg', NULL, NULL, 1, '2025-10-07 00:52:56', NULL),
(88, 1, 'new_message', '💬 antares en Chat con antares', '🖼️ Imagen: Avatar-PNG-Image-File.jpg', NULL, NULL, 1, '2025-10-07 00:52:56', NULL),
(89, 8, 'new_message', '💬 antares en Chat con Riberto', '🖼️ Imagen: Avatar-PNG-Image-File.jpg', 34, NULL, 0, '2025-10-07 04:50:01', NULL),
(90, 8, 'new_message', '💬 antares en Chat con Riberto', '📎 Archivo: proyecto fox-ia.docx', 34, NULL, 0, '2025-10-07 04:50:01', NULL),
(91, 8, 'new_message', '💬 antares en Chat con Riberto', '🖼️ Imagen: Avatar-PNG-Image-File.jpg', 34, NULL, 0, '2025-10-07 04:50:02', NULL),
(92, 1, 'new_message', '💬 antares en Chat con antares', '📎 Archivo: proyecto fox-ia (1).docx', NULL, NULL, 1, '2025-10-07 05:05:32', NULL),
(93, 2, 'new_message', '💬 admin en Chat con antares', 'gjhgjh', NULL, NULL, 1, '2025-10-07 06:35:19', NULL),
(94, 2, 'new_message', '💬 admin en Chat con antares', '🖼️ Imagen: Avatar-PNG-Image-File.jpg', NULL, NULL, 1, '2025-10-07 07:09:59', NULL),
(95, 2, 'new_message', '💬 admin en Chat con antares', '📎 Archivo: proyecto fox-ia.docx', NULL, NULL, 1, '2025-10-07 07:09:59', NULL),
(96, 1, 'new_message', '💬 antares en Chat con antares', 'hola', NULL, NULL, 1, '2025-10-07 07:11:15', NULL),
(97, 2, 'new_message', '💬 admin en Chat con antares', 'hola', NULL, NULL, 1, '2025-10-07 07:11:25', NULL),
(98, 1, 'new_message', '💬 antares en Chat con antares', '🖼️ Imagen: vector-logo-zorro_870994-58.jpg', NULL, NULL, 1, '2025-10-07 08:38:03', NULL),
(99, 1, 'self_reply', '↩️ antares respondió a su mensaje en Chat con antares', 'asd', NULL, NULL, 1, '2025-10-07 12:05:05', NULL),
(100, 1, 'new_message', '💬 antares en Chat con antares', 'asd', NULL, NULL, 1, '2025-10-07 13:36:14', NULL),
(101, 2, 'reply', '📨 admin respondió en Chat con antares', 'Dggd', NULL, NULL, 1, '2025-10-07 14:05:43', NULL),
(102, 2, 'new_message', '💬 admin en Chat con antares', 'Jdjdjdj', NULL, NULL, 1, '2025-10-07 14:05:59', NULL),
(103, 2, 'new_message', '💬 admin en Chat con antares', 'Jfjdhjddk', NULL, NULL, 1, '2025-10-07 14:06:05', NULL),
(104, 1, 'new_message', '💬 antares en Chat con antares', 'hgkjgjh', NULL, NULL, 1, '2025-10-07 14:06:15', NULL),
(105, 2, 'new_message', '💬 admin en Chat con antares', '🖼️ Imagen: 17598460415624734241544585994611.jpg', NULL, NULL, 1, '2025-10-07 14:07:53', NULL),
(106, 2, 'new_message', '💬 admin en Chat con antares', '🤣😏👍😆🤣', NULL, NULL, 1, '2025-10-07 14:09:46', NULL),
(107, 11, 'new_message', '💬 antares en Chat con roberto', 'sion', 37, NULL, 1, '2025-10-07 22:20:52', NULL),
(108, 11, 'new_message', '💬 antares en Chat con roberto', 'si', 37, NULL, 1, '2025-10-07 22:21:26', NULL),
(109, 2, 'new_message', '💬 roberto en Chat con roberto', 'a', 37, NULL, 1, '2025-10-07 22:22:43', NULL),
(110, 11, 'new_message', '💬 admin en Chat con roberto', 'sion', NULL, NULL, 0, '2025-10-08 00:33:37', NULL),
(111, 11, 'new_message', '💬 admin en Chat con roberto', '?', NULL, NULL, 0, '2025-10-08 00:33:44', NULL),
(112, 11, 'new_message', '💬 admin en Chat con roberto', '.', NULL, NULL, 0, '2025-10-08 00:34:04', NULL),
(113, 1, 'reply', '📨 antares respondió en Chat con antares', 'Está bonita 😍', NULL, NULL, 1, '2025-10-09 14:52:14', NULL),
(114, 2, 'new_message', '💬 admin en Chat con antares', 'aasd', NULL, NULL, 0, '2025-10-10 07:43:16', NULL),
(115, 2, 'new_message', '💬 admin en Chat con antares', 'asd', NULL, NULL, 0, '2025-10-10 09:10:53', NULL),
(116, 2, 'new_message', '💬 admin en Chat con antares', 'asd', NULL, NULL, 0, '2025-10-10 09:11:01', NULL),
(117, 2, 'new_message', '💬 admin en Chat con antares', 'asd', NULL, NULL, 0, '2025-10-10 09:11:14', NULL),
(118, 2, 'new_message', '💬 admin en Chat con antares', 'asd', NULL, NULL, 0, '2025-10-10 09:11:37', NULL),
(119, 2, 'new_message', '💬 admin en Chat con antares', 'asd', NULL, NULL, 0, '2025-10-10 09:11:42', NULL),
(120, 2, 'new_message', '💬 admin en Chat con antares', 'qwe', NULL, NULL, 0, '2025-10-10 09:11:51', NULL),
(121, 2, 'new_message', '💬 admin en Chat con antares', '123123', NULL, NULL, 0, '2025-10-10 09:12:02', NULL),
(122, 2, 'new_message', '💬 admin en Chat con antares', 'asdad', NULL, NULL, 0, '2025-10-10 09:12:22', NULL),
(123, 2, 'new_message', '💬 admin en Chat con antares', 'asdas', NULL, NULL, 0, '2025-10-10 09:12:30', NULL),
(124, 2, 'new_message', '💬 admin en Chat con antares', 'djfhsdkfhsdj', NULL, NULL, 0, '2025-10-12 00:16:22', NULL),
(125, 2, 'new_message', '💬 admin en Chat con antares', '🖼️ Imagen: 100010182239.png', NULL, NULL, 0, '2025-11-05 03:42:36', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `system_logs`
--

CREATE TABLE `system_logs` (
  `id` int(11) NOT NULL,
  `level` enum('DEBUG','INFO','WARNING','ERROR','CRITICAL') NOT NULL,
  `message` text NOT NULL,
  `context` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`context`)),
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `setting_type` enum('string','number','boolean','json') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `is_public`, `updated_at`, `updated_by`) VALUES
(1, 'site_name', 'Fox-IA', 'string', 'Nombre del sitio web', 1, '2025-09-16 09:32:02', NULL),
(2, 'site_description', 'Entorno Asistido por Inteligencia Artificial', 'string', 'Descripción del sitio web', 1, '2025-09-16 09:32:02', NULL),
(4, 'max_chat_context_triplets', '50', 'number', 'Máximo de tripletas de contexto a mantener por chat', 0, '2025-09-16 09:32:02', NULL),
(5, 'chat_context_expiry_days', '30', 'number', 'Días antes de que expire el contexto del chat', 0, '2025-09-16 09:32:02', NULL),
(6, 'require_email_verification', 'true', 'boolean', '¿Requiere verificación de email?', 0, '2025-09-16 09:32:02', NULL),
(7, 'allow_registrations', 'true', 'boolean', '¿Permitir nuevos registros?', 1, '2025-09-16 09:32:02', NULL),
(8, 'rate_limit_api', '100', 'number', 'Límite de requests por minuto en API', 0, '2025-09-16 09:32:02', NULL),
(9, 'JWT_SECRET_KEY', '-------------', 'string', 'Clave secreta para JWT tokens', 0, '2025-10-09 05:45:12', 1),
(15, 'APP_URL', 'https://foxia.duckdns.org:4430/public/api/auth', 'string', 'URL base de la aplicación', 1, '2025-10-09 05:45:12', 1),
(16, 'APP_ENV', 'development', 'string', 'Entorno de la aplicación (development/production)', 0, '2025-10-09 05:45:12', 1),
(17, 'SMTP_HOST', 'smtp.gmail.com', 'string', 'Servidor SMTP para envío de emails', 0, '2025-10-09 05:45:12', 1),
(18, 'SMTP_PORT', '587', 'number', 'Puerto del servidor SMTP', 0, '2025-10-09 05:45:12', 1),
(19, 'SMTP_USER', 'robertopv24@gmail.com', 'string', 'Usuario para autenticación SMTP', 0, '2025-10-09 05:45:12', 1),
(20, 'SMTP_PASSWORD', '-------------', 'string', 'Contraseña para autenticación SMTP', 0, '2025-10-09 05:48:00', 1),
(21, 'WS_HOST', '0.0.0.0', 'string', 'Host para servidor WebSocket', 0, '2025-10-09 05:45:12', 1),
(22, 'WS_PORT', '8888', 'number', 'Puerto para servidor WebSocket', 0, '2025-10-09 05:45:12', 1),
(23, 'REDIS_HOST', '127.0.0.1', 'string', 'Host del servidor Redis', 0, '2025-10-09 05:45:12', 1),
(24, 'REDIS_PORT', '6379', 'number', 'Puerto del servidor Redis', 0, '2025-10-09 05:45:12', 1),
(25, 'REDIS_PASSWORD', '', 'string', 'Contraseña para Redis (vacía si no hay)', 0, '2025-10-09 05:45:12', 1),
(26, 'REDIS_DB', '0', 'number', 'Base de datos Redis por defecto', 0, '2025-10-09 05:45:12', 1),
(27, 'REDIS_URI', 'redis://127.0.0.1:6379', 'string', 'URI de conexión a Redis', 0, '2025-10-09 05:45:12', 1),
(33, 'ngrok_authtoken', '----------------', 'string', 'Token de autenticación para el túnel de Ngrok del servidor de IA.', 0, '2025-10-10 09:32:56', NULL),
(34, 'ai_model_id', 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', 'string', 'ID del modelo de Hugging Face a utilizar para la IA.', 0, '2025-11-05 14:55:37', NULL),
(35, 'ai_temperature', '0.2', 'string', 'Controla la aleatoriedad de la respuesta de la IA (ej. 0.2).', 0, '2025-10-10 09:28:02', NULL),
(36, 'ai_top_p', '0.9', 'string', 'Parámetro Top-P para el muestreo del núcleo de la IA (ej. 0.9).', 0, '2025-10-10 09:28:02', NULL),
(37, 'ai_max_new_tokens', '1024', 'number', 'Número máximo de tokens a generar en una respuesta de la IA.', 0, '2025-10-10 09:28:02', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `uploaded_files`
--

CREATE TABLE `uploaded_files` (
  `id` int(11) NOT NULL,
  `uuid` char(36) NOT NULL,
  `user_id` int(11) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size` int(11) NOT NULL,
  `chat_id` int(11) DEFAULT NULL,
  `message_id` int(11) DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 0,
  `upload_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `uuid` char(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `privacy_settings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`privacy_settings`)),
  `is_active` tinyint(1) DEFAULT 1,
  `is_admin` tinyint(1) DEFAULT 0,
  `email_verified` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `uuid`, `email`, `password_hash`, `name`, `avatar_url`, `bio`, `location`, `website`, `phone`, `date_of_birth`, `privacy_settings`, `is_active`, `is_admin`, `email_verified`, `created_at`, `updated_at`, `last_login`) VALUES
(1, 'c47430fb-9520-11f0-8d1d-dbc85a66f495', 'robertopv100@gmail.com', '$2y$10$bJl.XUC/4xc93r6c7pbQt.aYycijHrNs8SmaFSPgDjGcZ8nmobBZS', 'admin', '/uploads/avatars/c47430fb-9520-11f0-8d1d-dbc85a66f495/avatar_1759818899_c64ad4394f194120.jpg', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 1, '2025-09-19 06:20:41', '2025-11-06 10:34:46', '2025-11-06 10:34:46'),
(2, '2887ca69-953b-11f0-8d1d-dbc85a66f495', 'robertopv3@gmail.com', '$2y$10$bJl.XUC/4xc93r6c7pbQt.aYycijHrNs8SmaFSPgDjGcZ8nmobBZS', 'antares', '/uploads/avatars/2887ca69-953b-11f0-8d1d-dbc85a66f495/avatar_1760021463_39af9ec8ea177cd4.jpg', NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 1, '2025-09-19 09:29:36', '2025-10-09 14:51:03', '2025-10-09 14:49:56'),
(3, '1ef894b4-968d-11f0-8d1d-dbc85a66f495', 'support@foxia.com', '$2y$10$cFiejWkrortMwLh0KPCQ9e5oPgOrbTFcFIGitzQs1.46QUeDSpjP6', 'support', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 1, '2025-09-21 01:48:50', '2025-09-21 01:49:55', '2025-09-21 01:49:55'),
(8, 'cbfa9f49-97e6-11f0-8015-b6259681c452', 'perozoriberto@gmail.com', '$2y$10$/odxn8mzscRbzpOPnkiEZOQHC1RzZiT/CsPauKzaMjQsjp.lgkgEa', 'Riberto', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 1, '2025-09-22 19:03:16', '2025-09-22 19:06:58', '2025-09-22 19:06:58'),
(11, 'f3d9489b-a0a5-11f0-9a47-afd51c0ef295', 'robertopv1988@gmail.com', '$2y$12$4qyWHPBinFk6Nu6dhJGlFehGkf.iy9M4JejYuMmdQngwt1uaAJVS.', 'roberto', '/uploads/avatars/f3d9489b-a0a5-11f0-9a47-afd51c0ef295/avatar_1759875742_77fb799d3063f04b.jpg', NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 1, '2025-10-03 22:11:46', '2025-10-07 22:22:22', '2025-10-07 22:19:57'),
(12, 'f3d0024c-a5b1-11f0-9f49-bd142ca1a145', 'robertopv2@gmail.com', '$2y$12$IpmuFRodOlDSBsOokhZ5BuktBs5lAhciayUSrVHXNRwRHUN4e.Nve', 'roberto2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 0, 1, '2025-10-10 08:21:34', '2025-10-10 08:27:56', '2025-10-10 08:27:56');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_contacts`
--

CREATE TABLE `user_contacts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `contact_id` int(11) NOT NULL,
  `nickname` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_blocked` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `user_contacts`
--

INSERT INTO `user_contacts` (`id`, `user_id`, `contact_id`, `nickname`, `created_at`, `is_blocked`) VALUES
(1, 2, 1, NULL, '2025-09-19 10:13:27', 0),
(3, 1, 2, '', '2025-09-19 16:38:47', 0),
(4, 3, 2, NULL, '2025-09-21 01:50:40', 0),
(5, 3, 1, NULL, '2025-09-21 01:50:47', 0),
(6, 8, 2, NULL, '2025-09-22 19:07:23', 0),
(7, 8, 1, NULL, '2025-09-22 19:07:30', 0),
(8, 8, 3, NULL, '2025-09-22 19:07:47', 0),
(9, 2, 3, NULL, '2025-10-02 15:14:53', 0),
(13, 2, 8, NULL, '2025-10-03 00:34:50', 0),
(14, 2, 11, NULL, '2025-10-07 22:20:38', 0),
(15, 11, 1, NULL, '2025-10-07 22:23:21', 0),
(16, 11, 8, NULL, '2025-10-07 22:23:47', 0),
(17, 11, 2, NULL, '2025-10-07 22:23:56', 0),
(18, 11, 3, NULL, '2025-10-07 22:24:06', 0),
(19, 1, 8, NULL, '2025-10-08 00:02:37', 0),
(20, 1, 11, NULL, '2025-10-08 00:02:41', 0),
(21, 1, 3, NULL, '2025-10-08 00:02:53', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `device_info` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime NOT NULL,
  `revoked` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `ai_nodes`
--
ALTER TABLE `ai_nodes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `node_url` (`node_url`);

--
-- Indices de la tabla `chats`
--
ALTER TABLE `chats`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `idx_uuid` (`uuid`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `idx_chat_type` (`chat_type`),
  ADD KEY `idx_updated` (`updated_at`);

--
-- Indices de la tabla `chat_context_triplets`
--
ALTER TABLE `chat_context_triplets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_id` (`chat_id`),
  ADD KEY `idx_subject` (`subject`(255)),
  ADD KEY `idx_predicate` (`predicate`(255)),
  ADD KEY `idx_object` (`object`(255)),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `message_id` (`message_id`);
ALTER TABLE `chat_context_triplets` ADD FULLTEXT KEY `idx_fulltext` (`subject`,`predicate`,`object`);

--
-- Indices de la tabla `chat_participants`
--
ALTER TABLE `chat_participants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_chat_user` (`chat_id`,`user_id`),
  ADD KEY `idx_chat_id` (`chat_id`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indices de la tabla `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `verification_token` (`verification_token`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_token` (`verification_token`);

--
-- Indices de la tabla `global_knowledge_history`
--
ALTER TABLE `global_knowledge_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_triplet_id` (`triplet_id`),
  ADD KEY `idx_changed_by` (`changed_by`),
  ADD KEY `idx_change_type` (`change_type`);

--
-- Indices de la tabla `global_knowledge_suggestions`
--
ALTER TABLE `global_knowledge_suggestions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_suggested_by` (`suggested_by`),
  ADD KEY `idx_subject` (`subject`(255)),
  ADD KEY `idx_predicate` (`predicate`(255)),
  ADD KEY `idx_object` (`object`(255)),
  ADD KEY `source_chat_id` (`source_chat_id`),
  ADD KEY `source_message_id` (`source_message_id`),
  ADD KEY `reviewed_by` (`reviewed_by`);

--
-- Indices de la tabla `global_knowledge_triplets`
--
ALTER TABLE `global_knowledge_triplets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_subject` (`subject`(255)),
  ADD KEY `idx_predicate` (`predicate`(255)),
  ADD KEY `idx_object` (`object`(255)),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_verified` (`is_verified`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `created_by` (`created_by`);
ALTER TABLE `global_knowledge_triplets` ADD FULLTEXT KEY `idx_fulltext` (`subject`,`predicate`,`object`,`description`);

--
-- Indices de la tabla `knowledge_categories`
--
ALTER TABLE `knowledge_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_unique_name` (`name`,`parent_id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_parent` (`parent_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indices de la tabla `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD KEY `idx_chat_id` (`chat_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `idx_uuid` (`uuid`),
  ADD KEY `fk_replying_to` (`replying_to_id`),
  ADD KEY `idx_messages_chat_created` (`chat_id`,`created_at`);
ALTER TABLE `messages` ADD FULLTEXT KEY `idx_content` (`content`);

--
-- Indices de la tabla `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_read` (`is_read`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `related_chat_id` (`related_chat_id`),
  ADD KEY `related_message_id` (`related_message_id`),
  ADD KEY `idx_notifications_user_read` (`user_id`,`is_read`,`created_at`);

--
-- Indices de la tabla `system_logs`
--
ALTER TABLE `system_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_level` (`level`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `idx_user` (`user_id`);

--
-- Indices de la tabla `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `idx_setting_key` (`setting_key`),
  ADD KEY `updated_by` (`updated_by`);

--
-- Indices de la tabla `uploaded_files`
--
ALTER TABLE `uploaded_files`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_chat_id` (`chat_id`),
  ADD KEY `idx_upload_token` (`upload_token`),
  ADD KEY `message_id` (`message_id`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uuid` (`uuid`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_uuid` (`uuid`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indices de la tabla `user_contacts`
--
ALTER TABLE `user_contacts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_user_contact` (`user_id`,`contact_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_contact_id` (`contact_id`);

--
-- Indices de la tabla `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_token_hash` (`token_hash`),
  ADD KEY `idx_expires` (`expires_at`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `ai_nodes`
--
ALTER TABLE `ai_nodes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `chats`
--
ALTER TABLE `chats`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT de la tabla `chat_context_triplets`
--
ALTER TABLE `chat_context_triplets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `chat_participants`
--
ALTER TABLE `chat_participants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=61;

--
-- AUTO_INCREMENT de la tabla `email_verifications`
--
ALTER TABLE `email_verifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT de la tabla `global_knowledge_history`
--
ALTER TABLE `global_knowledge_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `global_knowledge_suggestions`
--
ALTER TABLE `global_knowledge_suggestions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `global_knowledge_triplets`
--
ALTER TABLE `global_knowledge_triplets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `knowledge_categories`
--
ALTER TABLE `knowledge_categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=148;

--
-- AUTO_INCREMENT de la tabla `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=126;

--
-- AUTO_INCREMENT de la tabla `system_logs`
--
ALTER TABLE `system_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT de la tabla `uploaded_files`
--
ALTER TABLE `uploaded_files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `user_contacts`
--
ALTER TABLE `user_contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT de la tabla `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `chats`
--
ALTER TABLE `chats`
  ADD CONSTRAINT `chats_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `chat_context_triplets`
--
ALTER TABLE `chat_context_triplets`
  ADD CONSTRAINT `chat_context_triplets_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_context_triplets_ibfk_2` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `chat_participants`
--
ALTER TABLE `chat_participants`
  ADD CONSTRAINT `chat_participants_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `chat_participants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `global_knowledge_history`
--
ALTER TABLE `global_knowledge_history`
  ADD CONSTRAINT `global_knowledge_history_ibfk_1` FOREIGN KEY (`triplet_id`) REFERENCES `global_knowledge_triplets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `global_knowledge_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `global_knowledge_suggestions`
--
ALTER TABLE `global_knowledge_suggestions`
  ADD CONSTRAINT `global_knowledge_suggestions_ibfk_1` FOREIGN KEY (`source_chat_id`) REFERENCES `chats` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `global_knowledge_suggestions_ibfk_2` FOREIGN KEY (`source_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `global_knowledge_suggestions_ibfk_3` FOREIGN KEY (`suggested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `global_knowledge_suggestions_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `global_knowledge_triplets`
--
ALTER TABLE `global_knowledge_triplets`
  ADD CONSTRAINT `global_knowledge_triplets_ibfk_1` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `global_knowledge_triplets_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `knowledge_categories`
--
ALTER TABLE `knowledge_categories`
  ADD CONSTRAINT `knowledge_categories_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `knowledge_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `knowledge_categories_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_replying_to` FOREIGN KEY (`replying_to_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`related_chat_id`) REFERENCES `chats` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `notifications_ibfk_3` FOREIGN KEY (`related_message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `system_logs`
--
ALTER TABLE `system_logs`
  ADD CONSTRAINT `system_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `uploaded_files`
--
ALTER TABLE `uploaded_files`
  ADD CONSTRAINT `uploaded_files_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `uploaded_files_ibfk_2` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `uploaded_files_ibfk_3` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `user_contacts`
--
ALTER TABLE `user_contacts`
  ADD CONSTRAINT `user_contacts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_contacts_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
