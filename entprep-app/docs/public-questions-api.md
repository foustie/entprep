# ENTprep — API вопросов (read-only). Гайд для партнёра

Read-only доступ к банку вопросов ЕНТ. Партнёр **не** получает ключи Supabase — только персональный `x-api-key`, который владелец может отозвать в любой момент.

> Что передать партнёру: (1) URL ниже, (2) его личный `x-api-key`, (3) этот файл.

## Доступ

- **URL:** `https://entprep.org/.netlify/functions/public-questions`
- **Авторизация:** в каждый запрос добавляй заголовок
  ```
  x-api-key: <выданный тебе ключ>
  ```
- Метод только `GET`. Без валидного ключа — `401`.

## ⚠️ Главное правило: не дёргай API на каждое сообщение юзера

Вопросы статичные (33 000+, меняются редко). **Скачай весь банк один раз в сутки** к себе в базу/файл и отдавай юзерам из своей копии. Тогда нагрузка на API почти нулевая, а бот отвечает мгновенно при любом числе юзеров. Запрос на каждого юзера — неправильно: упрёшься в лимиты и будешь тормозить.

## Параметры (GET)

| Параметр  | Обяз. | Значения | По умолчанию |
|-----------|-------|----------|--------------|
| `subject` | да    | один из списка ниже | — |
| `mode`    | нет   | `list` \| `random` \| `counts` | `list` |
| `lang`    | нет   | `ru` \| `kk` \| `all` | `ru` |
| `topic`   | нет   | id темы (фильтр) | все темы |
| `limit`   | нет   | 1–1000 (только `mode=list`) | 100 |
| `offset`  | нет   | ≥0 (только `mode=list`) | 0 |
| `count`   | нет   | 1–50 (только `mode=random`) | 20 |

**subject:** `math`, `reading`, `history`, `math_profile`, `physics`, `biology`, `english`, `chemistry`, `geography`, `world_history`, `informatics`, `law`, `literature`.

## Режимы

### `mode=list` — постраничная выгрузка (для скачивания всего банка)
Листай по `offset`, пока `hasMore=false`.

```bash
curl -H "x-api-key: KEY" \
  "https://entprep.org/.netlify/functions/public-questions?subject=math&mode=list&limit=1000&offset=0"
```
Ответ:
```json
{
  "subject": "math",
  "questions": [ /* … */ ],
  "count": 1000,
  "total": 2516,
  "offset": 0,
  "limit": 1000,
  "hasMore": true,
  "nextOffset": 1000
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

Русский — всегда; казахский (`_kk`) — при `lang=kk` или `lang=all`.

| Поле | Значение |
|------|----------|
| `idx` | id вопроса внутри предмета |
| `topic`, `subtopic` | id темы/подтемы |
| `q` | текст вопроса |
| `o` | массив вариантов ответа |
| `c` | индекс правильного ответа (`single`) |
| `correct_indices` | массив индексов (`multiple`) |
| `pairs` | пары соответствий (`matching`) |
| `e` | объяснение |
| `type` | `single` \| `multiple` \| `matching` |
| `difficulty`, `block` | сложность / блок |
| `passage_*` | текст и заголовок (для reading) |
| `*_kk` | казахские версии полей |

## Готовый код синка (Python — запускать раз в сутки)

```python
import requests, time

API = "https://entprep.org/.netlify/functions/public-questions"
KEY = "ВАШ_КЛЮЧ"
SUBJECTS = ["math","reading","history","math_profile","physics","biology",
            "english","chemistry","geography","world_history","informatics","law","literature"]

def sync_subject(subject, lang="ru"):
    out, offset = [], 0
    while True:
        r = requests.get(API, headers={"x-api-key": KEY},
            params={"subject": subject, "mode": "list",
                    "limit": 1000, "offset": offset, "lang": lang}, timeout=60)
        r.raise_for_status()
        data = r.json()
        out += data["questions"]
        if not data["hasMore"]:
            break
        offset = data["nextOffset"]
        time.sleep(0.5)          # вежливая пауза между страницами
    return out

# Запускать по расписанию (cron / APScheduler) раз в сутки.
# Результат сохранить в свою БД или JSON-файлы.
bank = {s: sync_subject(s) for s in SUBJECTS}
# Дальше бот отдаёт вопросы юзерам ИЗ bank — в API на каждого юзера НЕ ходит.
```

### То же на Node.js

```js
const API = "https://entprep.org/.netlify/functions/public-questions";
const KEY = "ВАШ_КЛЮЧ";

async function syncSubject(subject, lang = "ru") {
  const out = [];
  let offset = 0;
  for (;;) {
    const url = `${API}?subject=${subject}&mode=list&limit=1000&offset=${offset}&lang=${lang}`;
    const res = await fetch(url, { headers: { "x-api-key": KEY } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    out.push(...data.questions);
    if (!data.hasMore) break;
    offset = data.nextOffset;
    await new Promise(r => setTimeout(r, 500)); // пауза между страницами
  }
  return out;
}
```

## Лимиты и правила

- **120 запросов/мин на ключ** (превысишь — `429`, подожди столько секунд, сколько в заголовке `Retry-After`). При синке раз в сутки с `limit=1000` весь банк ≈ 35 запросов — проблем нет.
- Максимум `limit=1000` за один запрос (это потолок). Больше за раз нельзя — используй пагинацию (`offset`), она выкачивает **весь** банк.
- На казахском: `lang=kk`; оба языка сразу: `lang=all`.
- Ключ держи в секрете (переменная окружения, не в коде на GitHub). Если ключ утёк — сообщи владельцу, выдадут новый.

## Коды ошибок

| Код | Причина |
|-----|---------|
| `401` | нет или неверный `x-api-key` |
| `400` | неверный `subject` или `mode` |
| `429` | слишком много запросов (см. `Retry-After`) |
| `503` | API временно выключен на стороне сервера |

---

## Для владельца (управление ключами)

Ключи хранятся в Netlify env `PARTNER_API_KEYS` (через запятую — один ключ на партнёра).

Сгенерировать новый ключ:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Добавить/убрать — Netlify → Site settings → Environment variables (сайт `95dda229-7f00-4ea7-8b23-d9ec28ed071d`), затем **Trigger deploy**. Удалил ключ → партнёр сразу теряет доступ (`401`).
