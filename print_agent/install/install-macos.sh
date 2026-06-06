#!/bin/bash
# Установка агента DreamBar как launchd-службы на macOS.
# Агент будет запускаться при входе пользователя в систему.
# Запускать из папки print_agent/:
#   bash install/install-macos.sh

set -e

INSTALL_DIR="$HOME/Library/DreamBarPrintAgent"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST="$PLIST_DIR/com.dreambar.print-agent.plist"

echo "=== Установка DreamBar Print Agent (macOS) ==="

# Копируем файлы агента
mkdir -p "$INSTALL_DIR"
cp agent.py requirements.txt "$INSTALL_DIR/"
[ -f config.ini ] && cp config.ini "$INSTALL_DIR/" || cp config.ini.example "$INSTALL_DIR/config.ini"

# Создаём виртуальное окружение
cd "$INSTALL_DIR"
python3 -m venv venv
venv/bin/pip install --quiet requests pyserial

# Создаём plist с правильными путями
mkdir -p "$PLIST_DIR"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dreambar.print-agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/venv/bin/python</string>
        <string>$INSTALL_DIR/agent.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$INSTALL_DIR/agent.log</string>
    <key>StandardErrorPath</key>
    <string>$INSTALL_DIR/agent.log</string>
</dict>
</plist>
EOF

# Загружаем службу
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "Готово! Агент запущен и добавлен в автозапуск при входе в систему."
echo "Файлы: $INSTALL_DIR"
echo "Настройте config.ini, затем перезапустите:"
echo "  launchctl unload $PLIST && launchctl load $PLIST"
echo "Логи: tail -f $INSTALL_DIR/agent.log"
