# Plan: Inventario de nevera/congelador — Fase 1

## 1. Objetivo

Al terminar, existe una web app funcional donde se puede: registrar una entrada de producto (con porciones individuales y vencimiento automático a 3 meses), registrar una salida eligiendo qué porción(es) salieron, y ver un inventario agrupado por producto con la porción más próxima a vencer. Usuario único, sin login.

## 2. Contexto del problema

Hoy la única forma de saber qué hay guardado en el congelador es mirar las etiquetas físicas, frente a la nevera. Las decisiones de qué cocinar o comprar se toman en otro lugar (súper, oficina), donde esa información no está disponible. El registro manual ya es un hábito existente; falta que sea consultable a distancia.

## 3. El spec de referencia

[docs/specs/2026-07-12-inventario-nevera-fase1.md](../specs/2026-07-12-inventario-nevera-fase1.md)

## 4. Lista de tareas a implementar, con detalles

1. **Definir el esquema de datos y montar la base de datos**
   - Qué hacer: crear la tabla `productos` (id, nombre normalizado) y la tabla `porciones` (id, producto_id, fecha_entrada, fecha_vencimiento, estado: activa/consumida).
   - Dónde: capa de datos del proyecto (ej. `schema.prisma` o equivalente si se usa un ORM; si se usa Supabase, la tabla se crea directo en el dashboard).
   - Detalle: `fecha_vencimiento` se calcula y guarda al momento de crear la porción (`fecha_entrada + 3 meses`), no se recalcula en cada consulta. `nombre` en `productos` se guarda normalizado (trim + minúsculas) para que coincidencias exactas de texto se agrupen, según la mitigación de duplicados del spec.

2. **Construir el formulario "Nueva entrada"**
   - Qué hacer: formulario con campo de texto para nombre de producto, campo numérico para número de porciones (entero, mínimo 1, sin default vacío), selector de fecha con "hoy" por defecto y sin permitir fechas futuras.
   - Dónde: página/ruta `/entrada` (o equivalente).
   - Detalle: al guardar, si el producto (nombre normalizado) no existe en `productos`, se crea; si ya existe, se reutiliza. Se crean tantos registros en `porciones` como el número indicado, todos con la misma `fecha_entrada` y `fecha_vencimiento` calculada.

3. **Construir el formulario "Nueva salida"**
   - Qué hacer: selector/buscador de producto, seguido de una lista de sus porciones activas ordenadas por `fecha_entrada` ascendente (la más antigua primero), con selección múltiple.
   - Dónde: página/ruta `/salida` (o equivalente).
   - Detalle: solo se listan productos que tengan al menos una porción con estado `activa` (cubre el error "salida de producto sin porciones disponibles" del spec). Al guardar, las porciones seleccionadas cambian su estado a `consumida`.

4. **Construir la vista de inventario**
   - Qué hacer: pantalla principal que lista productos con porciones activas, mostrando nombre, conteo de porciones activas, y la `fecha_vencimiento` más próxima entre sus porciones.
   - Dónde: página/ruta `/` o `/inventario`.
   - Detalle: cada producto es expandible para mostrar el detalle por porción (fecha de entrada, fecha de vencimiento). Productos sin porciones activas no aparecen en esta vista, según el spec.

5. **Marcar visualmente las porciones vencidas**
   - Qué hacer: en la vista de inventario (lista y detalle expandido), aplicar un indicador visual (ej. color o etiqueta) a cualquier porción activa cuya `fecha_vencimiento` ya pasó respecto a hoy.
   - Dónde: componente de la vista de inventario (tarea 4).
   - Detalle: no se borra ni se cambia el estado de la porción automáticamente — solo se marca visualmente. Corresponde a la mitigación de "porción vencida sin registrar salida" del spec.

6. **Validaciones de formulario (entrada y salida)**
   - Qué hacer: bloquear el guardado si el número de porciones es 0, negativo, o no es un entero; bloquear si no hay fecha de entrada seleccionada; bloquear si la fecha de entrada es futura.
   - Dónde: formulario "Nueva entrada" (tarea 2), a nivel de cliente y de servidor.
   - Detalle: mensajes de error visibles junto al campo correspondiente, no un error genérico. Cubre las filas de "número de porciones inválido" y "fecha vacía o futura" de la tabla de errores del spec.

## Siguiente paso

Implementar en este orden. Al terminar, correr `verify-after-changes` comparando contra este plan y contra el spec referenciado.
