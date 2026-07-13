# Inventario de nevera/congelador — Fase 1

## 1. Overview

Web app para registrar entradas y salidas de comida guardada en nevera/congelador, y consultar desde cualquier lugar qué hay, cuánto queda y cuánto falta para que venza. Este documento fija el alcance de la Fase 1 definida en `outputs/tracker-nevera/roadmap.md` antes de construirla.

## 2. Usuarios objetivo

Un solo usuario (Mariana) que guarda comida en porciones en el congelador y necesita saber, sin ir físicamente a mirar, qué tiene disponible y desde cuándo. Uso compartido con otras personas del hogar queda fuera de esta fase (ver Alcance v1).

## 3. Contexto del problema

Hoy la única forma de saber qué hay guardado es mirar las etiquetas físicas en los recipientes, frente a la nevera. Las decisiones de qué cocinar o comprar se toman en otro lugar (súper, oficina), donde esa información no está disponible. El registro manual por etiqueta ya existe como hábito; el problema es que no es consultable a distancia.

## 4. Alcance v1

**Incluye:**
- Registrar entrada: nombre del producto (texto libre), número de porciones, fecha de entrada. Cada porción queda como registro individual con su propia fecha.
- Vencimiento automático: cada porción calcula su fecha de vencimiento como fecha de entrada + 3 meses.
- Registrar salida: elegir producto y cuál(es) porción(es) específica(s) salieron; esas porciones dejan de contar en el inventario.
- Vista de inventario: lista de productos con conteo de porciones restantes por producto, y la porción más próxima a vencer de cada uno.

**No incluye (a propósito):**
- Cuentas de usuario o login — es un solo usuario en esta fase, no hace falta autenticación.
- Uso compartido entre varias personas — depende de que exista login; se evalúa en Fase 2.
- Catálogo de productos predefinido o autocompletado — se usa texto libre; si se generan duplicados por nombres distintos, se ajusta en una v2.
- Alertas o notificaciones de vencimiento próximo — Fase 2, una vez haya datos reales para calibrar el umbral de aviso.
- Sugerencias de qué cocinar, recetas, o descuento automático de porciones por consumo estimado — fuera de alcance del producto completo, no solo de esta fase.

## 5. Comportamiento esperado

**Flujo principal — registrar entrada:**
1. El usuario abre "Nueva entrada".
2. Escribe el nombre del producto (texto libre).
3. Indica cuántas porciones entraron (número entero, mínimo 1).
4. Selecciona la fecha de entrada (por defecto, hoy).
5. Al guardar, el sistema crea un registro individual por cada porción, todas con la misma fecha de entrada y con vencimiento = fecha de entrada + 3 meses.

**Flujo principal — registrar salida:**
1. El usuario abre "Nueva salida".
2. Busca o selecciona el producto por nombre.
3. Ve la lista de porciones disponibles de ese producto, ordenadas por fecha de entrada (la más antigua primero).
4. Selecciona cuál(es) porción(es) sacó.
5. Al guardar, esas porciones se marcan como consumidas y dejan de aparecer en el inventario activo.

**Flujo principal — ver inventario:**
1. El usuario abre la vista de inventario.
2. Ve una lista agrupada por producto: nombre, número de porciones activas, y fecha de vencimiento de la porción más próxima a vencer.
3. Puede expandir un producto para ver el detalle de cada porción individual (fecha de entrada, fecha de vencimiento).

**Variantes:**
- Si un producto no tiene porciones activas, no aparece en la vista de inventario (o aparece marcado como "sin stock", a decidir en diseño de interfaz).
- Si dos entradas usan nombres distintos para el mismo producto real (ej. "pollo" y "Pollo troceado"), el sistema los trata como productos separados — es una limitación conocida y aceptada de v1.

## 6. Posibles errores y mitigaciones

| Caso | Qué pasa si no se maneja | Mitigación |
|---|---|---|
| Usuario intenta registrar salida de un producto sin porciones disponibles | La app deja seleccionar una porción que no existe, o falla sin explicación | Si el producto no tiene porciones activas, no se muestra como opción para registrar salida |
| Usuario registra 0 o un número negativo de porciones | Se crean registros inválidos que rompen el conteo del inventario | Validar que el número de porciones sea un entero mayor a 0 antes de guardar |
| Fecha de entrada vacía o en el futuro | El cálculo de vencimiento queda mal o el inventario muestra datos inconsistentes | Fecha de entrada obligatoria, con valor por defecto "hoy"; no se permite seleccionar una fecha futura |
| Nombres de producto con variaciones de escritura (mayúsculas, espacios, singular/plural) | El inventario se fragmenta en productos que en realidad son el mismo | Normalizar el texto al guardar (recortar espacios, comparar sin distinguir mayúsculas) para agrupar coincidencias exactas; duplicados por redacción distinta quedan como limitación conocida de v1 |
| Porción vencida que sigue sin registrarse su salida | El inventario muestra como "disponible" algo que probablemente ya no sirve, sin ninguna señal | La vista de inventario marca visualmente las porciones cuya fecha de vencimiento ya pasó (sin borrarlas ni notificar — eso es Fase 2) |

## 7. Éxito

Durante una semana de uso real, cada entrada y cada salida de comida se registra en la app (no en la etiqueta física ni en una nota aparte), sin saltarse ningún registro. Esa es la misma señal de validación definida en el roadmap: si el hábito se sostiene los 7 días, el modelo de registro manual funciona y justifica seguir construyendo sobre esta base.

## Siguiente paso

Convertir esta Fase 1 en plan de implementación con el skill `design-plan`, usando este spec como referencia obligatoria.
