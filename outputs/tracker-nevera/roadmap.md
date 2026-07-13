# Roadmap: Tracker de Nevera/Congelador
Fecha: 2026-07-12

## La idea en una frase
App de inventario de nevera/congelador para consultar remotamente qué hay guardado, cuántas porciones quedan y desde cuándo, sin tener que ir físicamente a mirar.

## La acción core
Registrar una entrada o salida de producto y ver al instante el inventario actualizado (qué hay, cuánto queda, cuánto falta para el vencimiento). Sin este ciclo de registro-consulta no hay producto: es un solo loop, no dos features separadas.

## Fase 1 — Lanzamiento
| # | Feature | Por qué va primero | Depende de |
|---|---------|--------------------|------------|
| 1 | Registrar entrada (qué es, cuántas porciones, fecha) | Sin esto no hay datos que consultar; es el punto de partida del loop core | — |
| 2 | Vencimiento automático a 3 meses desde la fecha de entrada | Cálculo simple sobre el dato de entrada; es lo que convierte "hay algo guardado" en "cuánto falta para que se dañe", que es parte del valor prometido | #1 |
| 3 | Registrar salida (qué porción se sacó y cuándo) | Cierra el loop: sin descuento manual el inventario deja de ser confiable (riesgo ya identificado en el brainstorming) | #1 |
| 4 | Vista de inventario actual (qué hay, porciones restantes, días para vencer) | Es donde se materializa la visibilidad remota — el problema real que motivó el proyecto | #1, #2, #3 |

No se recorta más porque estas cuatro features son el mismo ciclo: registrar sin poder ver no sirve, y ver sin poder registrar no tiene datos. Cortar cualquiera rompe el loop mínimo.

## Fase 2 — Mejora
1. **Uso compartido** (más de una persona del hogar ve y actualiza el mismo inventario) — requiere cuentas/autenticación, que es esfuerzo real; se agrega una vez que el registro individual ya demostró ser sostenible.
2. **Alertas de vencimiento próximo** — solo tiene sentido una vez que hay suficientes entradas reales corriendo por el sistema para saber qué umbral de aviso es útil.
3. **Historial de consumo por producto** — útil para decisiones de compra, pero depende de acumular varias semanas de datos reales de la Fase 1.

## Backlog
- Planeación de comidas / sugerencias de qué cocinar — fuera de alcance explícito en v0, y es una decisión que el usuario quiere seguir tomando él mismo.
- Descuento automático de porciones por supuestos de consumo — contradice el modelo de registro manual controlado que se definió como intencional.
- Recetas — no acerca a la acción core (visibilidad de inventario).
- Usuarios externos fuera del hogar — dolor distinto (olvido, no visibilidad remota); se evalúa solo si se decide expandir el producto a otro público.
- Dashboards / analítica de consumo, gamificación — features de vanidad: no acercan al usuario a registrar o consultar, que es todo lo que este producto necesita hacer.

## Siguiente paso
Convertir la Fase 1 en spec con el skill de specs disponible (`design-spec` o `crear-specs`), usando este roadmap como contexto.
