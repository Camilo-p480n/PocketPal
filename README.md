Para la función de la asincronía
```
Botón "Sincronizar" en dashboard
  → POST /api/gmail/sync
  → Lee últimos 30 días de Gmail
  → Detecta banco por remitente
  → Parsea monto, tipo, fecha, comercio
  → Inserta en transactions (sin duplicados)
  → Responde { inserted: 3, skipped: 1 }

Cada hora automáticamente
  → Cron recorre todos los usuarios con token
  → Misma lógica de sync
  → Sin intervención del usuario