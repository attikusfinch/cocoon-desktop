# Cocoon Desktop

Лёгкое десктопное приложение для сети COCOON (децентрализованный AI-инференс
на TON): чат с ИИ, кошелёк и платежи, статус сети.

Оболочка — Tauri 2 (Rust) + React/TypeScript. Ядро — [gocoon](../gocoon)
(`gocoon-runner`), бандлится как sidecar-процесс и поднимает локальный
OpenAI-совместимый API.

Полный план: [../gocoon/docs/app-plan.md](../gocoon/docs/app-plan.md).

## Структура воркспейса

```
cocoon-app/
├─ gocoon/    # форк attikusfinch/gocoon — ядро (Go), ветка app-rework
└─ desktop/   # это приложение (Tauri 2)
```

## Разработка

Требования: Node 18+, Rust (stable, MSVC на Windows), Go 1.25+.

```powershell
# 1. Собрать sidecar (gocoon-runner) из ../gocoon
npm run sidecar          # или scripts/build-sidecar.sh на macOS/Linux

# 2. Запустить в dev-режиме
npm run tauri dev

# 3. Собрать установщик
npm run tauri build
```

Sidecar кладётся в `src-tauri/binaries/gocoon-runner-<target-triple>[.exe]`
и не коммитится (генерируется из ../gocoon).

## Как это работает

- Rust-слой (src-tauri/src/lib.rs) управляет жизненным циклом
  `gocoon-runner`: команды `runner_start` / `runner_stop` / `runner_status` /
  `runner_logs`, события `runner-log` и `runner-exit`, остановка процесса
  при выходе из приложения.
- Данные (кошелёк, конфиг) живут в `<user config dir>/Cocoon` — тот же
  каталог, что у `gocoon ui`, поэтому CLI и апка взаимозаменяемы.
- Фронтенд общается с раннером напрямую по `http://127.0.0.1:10000`
  (OpenAI-совместимый API + control plane).
