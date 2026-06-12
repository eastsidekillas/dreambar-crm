# Агент печати DreamBar (принтер на кассовом ПК)

Нужен только если принтер **подключён к отдельному ПК** (USB/COM), а backend
крутится на сервере. Для **Ethernet-принтера агент не нужен** — backend печатает
сам по сети.

Распространяется как **два .exe + config.ini** — Python на кассовом ПК не нужен.

## Файлы

| Файл | Назначение |
|------|-----------|
| `dreambar-print-agent.exe` | Агент (фоновый процесс / служба) |
| `dreambar-setup.exe` | Конфигуратор с GUI — настройка и тестовый запуск |
| `config.ini` | Настройки (создаётся из `config.ini.example`) |

## Как это работает

```
Angular → POST /api/receipts/{id}/print/ → backend кладёт задание в очередь
                                           (принтер с connection=agent)
agent.exe на кассовом ПК → опрашивает /api/print/agent/jobs/ → печатает → ack
```

## Быстрый старт (Windows)

1. Установить драйвер принтера — принтер появится в «Устройства и принтеры».
2. В админке сайта (**Принтеры** → карточка принтера → кнопка «Скачать config.ini»)
   скачать готовый конфиг — адрес сервера, id и ключ уже вписаны.
3. Положить в одну папку `dreambar-print-agent.exe`, `dreambar-setup.exe`, `config.ini`.
4. Запустить `dreambar-print-agent.exe` (или открыть `dreambar-setup.exe` →
   **▶ Запустить агента**, если нужно посмотреть лог или поправить настройки —
   например, вписать имя принтера в `windows_printer`).

Для **постоянной работы в фоне** (без открытого окна) → настроить службу (см. ниже).

## Настройка backend (один раз)

В админке сайта → **Принтеры** → добавить:
- **Подключение:** `USB-агент`
- **Ключ агента:** оставить пустым — сгенерируется автоматически
- **По умолчанию:** включить, если это основной принтер

После сохранения нажать на карточке принтера «Скачать config.ini» — в нём уже
заполнены backend_url, printer_id и agent_key. Кнопка тестовой печати работает
и для агентских принтеров: задание встаёт в очередь и печатается, когда агент
его заберёт.

## Режимы печати (config.ini → `mode`)

| mode | когда | что указать |
|------|-------|-------------|
| `windows` | обычный случай на Windows (рекомендуется) | `windows_printer` = имя принтера |
| `serial` | принтер как COM-порт (USE = RS-232) | `serial_port`, `serial_baud` |
| `usb` | прямой USB через libusb (нужен Zadig) | `usb_vendor`, `usb_product` |
| `raw` | Linux, символьное устройство | `raw_path` = /dev/usb/lp0 |

## Автозапуск при включении ПК

### Windows — служба через NSSM (рекомендуется)

1. Скачать [NSSM](https://nssm.cc/download), положить `nssm.exe` в папку `install/`.
2. Запустить `install\install-windows.bat` от имени Администратора.

Управление службой: `services.msc` (искать «DreamBarPrintAgent»).

Для удаления: `nssm remove DreamBarPrintAgent confirm`

### Windows — автозагрузка (без прав администратора)

`Win+R` → `shell:startup` → положить ярлык на `dreambar-print-agent.exe`.

### Linux — systemd

```bash
sudo bash install/install-linux.sh
# Логи: journalctl -u dreambar-print-agent -f
```

### macOS — launchd

```bash
bash install/install-macos.sh
# Логи: tail -f ~/Library/DreamBarPrintAgent/agent.log
```

## Сборка .exe (Windows, один раз)

```bat
py -m pip install -r requirements.txt
build.bat
```

Результат в `dist/`: `dreambar-print-agent.exe` + `dreambar-setup.exe`.

## Диагностика

- Статусы заданий и тексты ошибок видны в **Принтеры** → **Задания печати** (Django admin).
- Агент устойчив к обрыву сети (повторяет опрос каждые N секунд).
- После перезапуска агента задания, которые не были подтверждены, автоматически
  возвращаются в очередь и печатаются снова.
- Лог агента: окно конфигуратора, или `agent.log` рядом с exe (при работе как служба).
