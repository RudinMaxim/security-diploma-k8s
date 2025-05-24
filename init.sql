CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL
);

-- Вставка мок-данных пользователей
INSERT INTO
    users (name, email)
VALUES (
        'Иван Петров',
        'ivan.petrov@example.com'
    ),
    (
        'Мария Сидорова',
        'maria.sidorova@example.com'
    ),
    (
        'Алексей Козлов',
        'alexey.kozlov@example.com'
    ),
    (
        'Елена Васильева',
        'elena.vasilieva@example.com'
    ),
    (
        'Дмитрий Смирнов',
        'dmitry.smirnov@example.com'
    ),
    (
        'Анна Федорова',
        'anna.fedorova@example.com'
    ),
    (
        'Сергей Морозов',
        'sergey.morozov@example.com'
    ),
    (
        'Ольга Новикова',
        'olga.novikova@example.com'
    ),
    (
        'Михаил Волков',
        'mikhail.volkov@example.com'
    ),
    (
        'Татьяна Соколова',
        'tatiana.sokolova@example.com'
    )
ON CONFLICT DO NOTHING;