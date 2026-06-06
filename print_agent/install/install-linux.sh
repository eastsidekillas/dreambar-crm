#!/bin/bash
# Установка агента DreamBar как systemd-службы на Linux (Ubuntu/Debian/CentOS).
# Запускать с правами sudo из папки print_agent/:
#   sudo bash install/install-linux.sh

set -e

INSTALL_DIR=/opt/dreambar-print-agent
SERVICE=dreambar-print-agent

echo "=== Установка DreamBar Print Agent ==="

# Копируем файлы агента
mkdir -p "$INSTALL_DIR"
cp agent.py requirements.txt "$INSTALL_DIR/"
[ -f config.ini ] && cp config.ini "$INSTALL_DIR/" || cp config.ini.example "$INSTALL_DIR/config.ini"

# Создаём виртуальное окружение и устанавливаем зависимости
cd "$INSTALL_DIR"
python3 -m venv venv
venv/bin/pip install --quiet requests pyserial

# Устанавливаем systemd-юнит
cp "$(dirname "$0")/dreambar-print-agent.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo ""
echo "Готово! Служба $SERVICE запущена и добавлена в автозапуск."
echo "Настройте /opt/dreambar-print-agent/config.ini, затем:"
echo "  sudo systemctl restart $SERVICE"
echo "Логи: journalctl -u $SERVICE -f"
