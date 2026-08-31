# Aethra — сайт

Сайт Aethra на Express: HTML + CSS + ванильный JS, личный кабинет, подписки,
защищённое скачивание лоадера и регистрация с CAPTCHA.

## Запуск

```bash
npm start
```

Затем открыть <http://localhost:5177>. Порт берётся из переменной `PORT`.

В production можно включить Cloudflare Turnstile переменными `TURNSTILE_SITEKEY`
и `TURNSTILE_SECRET`. Если они не заданы, регистрация использует встроенную
одноразовую математическую CAPTCHA.

## Структура

```
index.html      главная: герой, возможности, активность, тарифы, FAQ
terms.html      условия использования, оглавление со scrollspy
profile.html    личный кабинет: аккаунт / купить ключ / подписка / инструменты
login.html      вход
register.html   регистрация с CAPTCHA
server.js       Express API и раздача сайта
storage.js      локальное JSON- или PostgreSQL-хранилище
assets/css/*    дизайн-токены и компоненты
assets/js/*     UI, API-клиент, иконки и фон
loader/         собранный веб-интерфейс лоадера
downloads/      файл AethraLoader.exe для скачивания
```

## Дизайн-система

Токены живут в `assets/css/tokens.css` тремя слоями: примитивы (`--n-*`, `--a-*`,
`--sp-*`) → семантика (`--bg`, `--fg`, `--border`, `--accent`) → компонентные
(`--btn-h`, `--card-*`, `--nav-*`). Менять тему следует на семантическом слое.

## Доступность

- Разметка: landmarks, skip-link, видимые `:focus-visible`, тач-цели ≥ 44px.
- Табы кабинета — паттерн ARIA tabs со стрелками, Home/End и синхронизацией с хешем URL.
- Точки графика доступны с клавиатуры и подписаны через `aria-label`.
- `prefers-reduced-motion` отключает анимации и переводит фон в один статичный кадр.
- Без WebGL фон деградирует в CSS-градиенты.

