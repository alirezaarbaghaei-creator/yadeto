<?php
/**
 * YADETO API — Database Configuration
 *
 * ONLY database connection credentials live here.
 * All other settings (AI, SMS, Zarinpal) are stored in and
 * read from the YADETO_settings table in the database.
 *
 * Edit these values to match your hosting's MySQL database.
 */

return [
    'db_host' => getenv('YADETO_DB_HOST') ?: 'localhost',
    'db_name' => getenv('YADETO_DB_NAME') ?: 'YADETO',
    'db_user' => getenv('YADETO_DB_USER') ?: 'YADETO',
    'db_pass' => getenv('YADETO_DB_PASS') ?: 'CHANGE_THIS_PASSWORD',
    'db_charset' => 'utf8mb4',
];
