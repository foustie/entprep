# ENTprep — Public Questions API (read-only)

Read-only доступ к банку вопросов для внешних партнёров. Партнёр **не** получает ключи Supabase — только персональный `x-api-key`, который можно отозвать в любой момент.

## Базовый URL

```
https://entprep.org/.netlify/functions/public-questions
```

## Аутентификация

Заголовок в каждом запросе:

```
x-api-key: <выданный ключ>
```

Без валидного ключа — `401`. Если на сервере ещё не настроены ключи — `503 API not enabled`.

## Лимиты

120 запросов в минуту на ключ. При превышении — `429` с заголовком `Retry-After` (секунды).

## Параметры (GET)

| Параметр  | Обяз. | Значения | По умолчанию |
|-----------|-------|----------|--------------|
| `subject` | да    | один из списка ниже | — |
| `mode`    | нет   | `list` \| `random` \| `counts` | `list` |
| `topic`   | нет   | id темы (фильтр) | все темы |
| `lang`    | нет   | `ru` \| `kk` \| `all` | `ru` |
| `limit`   | нет   | 1–200 (только `mode=list`) | 100 |
| `offset`  | нет   | ≥0 (только `mode=list`) | 0 |
| `count`   | нет   | 1–50 (только `mode=random`) | 20 |

**subject:** `math`, `reading`, `history`, `math_profile`, `physics`, `biology`, `english`, `chemistry`, `geography`, `world_history`, `informatics`, `law`, `literature`.

## Режимы

### `mode=list` — постраничный экспорт (по порядку)
Для выгрузки всех вопросов предмета: листай по `offset`, пока `hasMore=false`.

```bash
curl -H "x-api-key: KEY" \
  "https://entprep.org/.netlify/functions/public-questions?subject=math&mode=list&limit=100&offset=0"
```
Ответ:
```json
{
  "subject": "math",
  "questions": [ /* … */ ],
  "count": 100,
  "total": 2500,
  "offset": 0,
  "limit": 100,
  "hasMore": true,
  "nextOffset": 100
}
```

### `mode=random` — N случайных вопросов
```bash
curl -H "x-api-key: KEY" \
  "https://entprep.org/.netlify/functions/public-questions?subject=physics&mode=random&count=20"
```

### `mode=counts` — статистика по темам
```bash
curl -H "x-api-key: KEY" \
  "https://entprep.org/.netlify/functions/public-questions?subject=biology&mode=counts"
```
Ответ: `{ "subject": "biology", "total": 1234, "topics": {...}, "subtopics": {...} }`

## Формат вопроса

Поля (русский всегда; `_kk` — при `lang=kk|all`):

| Поле | Значение |
|------|----------|
| `idx` | порядковый id внутри предмета |
| `topic`, `subtopic` | id темы/подтемы |
| `q` | текст вопроса |
| `o` | массив вариантов ответа |
| `c` | индекс правильного ответа (single) |
| `correct_indices` | массив индексов (multiple) |
| `pairs` | пары (matching) |
| `e` | объяснение |
| `type` | `single` \| `multiple` \| `matching` |
| `difficulty`, `block` | сложность / блок |
| `passage_*` | для текстов (reading) |
| `*_kk` | казахские варианты |

## Управление ключами (для владельца)

Ключи хранятся в Netlify env `PARTNER_API_KEYS` (через запятую). 

Сгенерировать новый ключ:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Добавить/убрать — в Netlify → Site settings → Environment variables (сайт `95dda229-7f00-4ea7-8b23-d9ec28ed071d`), затем redeploy. Удалил ключ → партнёр сразу теряет доступ.
