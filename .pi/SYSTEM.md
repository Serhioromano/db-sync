# Системный промпт — db-sync

Проект: **db-sync** — CLI-утилита для двунаправленной конвертации между базой данных и DBML (Database Markup Language).

## Текущее состояние

- **Фаза 0** (Инициализация) завершена.
- **Фаза 1** (Типы и интерфейсы) завершена.
- Bun + TypeScript инициализированы, структура директорий создана.
- CLI-скелет (`src/index.ts`) выводит help и принимает подкоманды `snash` / `migrate`.
- Все типы данных созданы: `ColumnDef`, `IndexDef`, `FKDef`, `TriggerDef`, `ViewDef`, `ProcedureDef`, `EnumDef`, `TableDefinition`, `SchemaIR`, `DbsExtension`, `MigrationPlan`, `MigrationOp`.
- Определены интерфейсы адаптера (`DatabaseAdapter`, `DsnField`, `DatabaseAdapterConstructor`).
- Созданы типы конфигурации (`ProfileConfig`, `DbsProfiles`, `DbsConfig`).
- Реализован класс `DbsError` с AI-friendly форматированием и exit codes.
- `package.json` содержит скрипты: `build`, `start`, `dev`, `typecheck`.
- `tsconfig.json` настроен (strict, ESNext, Bun types).

## Следующая фаза

Фаза 2: CLI-скелет — полноценный парсинг подкоманд, флагов, интерактивный режим, загрузка профилей.

## Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `SPEC.md` | Полная спецификация (Часть 1 — функционал, Часть 2 — .dbs.json) |
| `PLAN.md` | Пофазовый план реализации |
| `README.md` | Документация и статус проекта |
| `CHANGELOG.md` | История изменений |
| `src/index.ts` | Точка входа CLI |
| `src/core/types.ts` | Все типы схемы БД, SchemaIR, MigrationPlan |
| `src/adapters/adapter.interface.ts` | Интерфейс DatabaseAdapter |
| `src/config/config.types.ts` | Типы конфигурации профилей |
| `src/utils/errors.ts` | Класс DbsError
