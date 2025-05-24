# 1) Стадия сборки
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем только package-файлы и ставим prod-зависимости
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Копируем весь код
COPY . .

# 2) Стадия рантайма
FROM node:18-alpine

WORKDIR /app

# Создаём группу и пользователя без статического GID
# -S: addgroup/adduser в “system mode”, без пароля
RUN addgroup -S appgroup \
    && adduser  -S appuser -G appgroup

# Копируем из builder-а, меняя владельца на нашего непривилегированного юзера
COPY --from=builder --chown=appuser:appgroup /app /app

# Переключаемся на непривилегированного пользователя
USER appuser

# Открываем порт и запускаем
EXPOSE 3000
CMD ["node", "src/server.js"]
