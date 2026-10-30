#!/usr/bin/env bash
# Se ejecuta después de "npx cap add android": permisos, ícono de notificación e íconos de la app.
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"
RES="android/app/src/main/res"

# Permisos: notificaciones, alarmas exactas (puntualidad), vibración y reinicio del teléfono
if ! grep -q "POST_NOTIFICATIONS" "$MANIFEST"; then
  sed -i 's#<application#<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />\n    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />\n    <uses-permission android:name="android.permission.VIBRATE" />\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\n    <application#' "$MANIFEST"
fi

# Ícono pequeño de la barra de notificaciones
mkdir -p "$RES/drawable"
cp resources/android/ic_stat_icon.xml "$RES/drawable/ic_stat_icon.xml"

# Íconos de la app (si falla, se queda el ícono por defecto y el APK se genera igual)
npx @capacitor/assets generate --android --iconBackgroundColor '#F472B6' --iconBackgroundColorDark '#DB2777' --splashBackgroundColor '#FFF0F5' --splashBackgroundColorDark '#2E1065' || echo "! No se pudieron generar los íconos; se usa el ícono por defecto."

echo "✔ Android configurado"
