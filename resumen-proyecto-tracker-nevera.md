# Resumen del Proyecto: Tracker de Nevera/Congelador

## Contexto

Proyecto final del reto de aprendizaje de Claude, que recorre el flujo completo: Chat (definir la idea) → Cowork (insumos) → Claude Design (interfaz) → Claude Code (publicación).

## Idea refinada

Una app de inventario de nevera/congelador para **visibilidad remota**: saber qué hay guardado, cuántas porciones quedan de cada cosa, y desde cuándo, consultable desde el celular (súper, oficina) sin tener que ir físicamente a mirar.

Registro **manual** de entradas y salidas por porción — la app no adivina consumo ni sugiere qué cocinar. Esas decisiones las toma el usuario.

## Problema real que resuelve

No es un problema de memoria ni de falta de registro (ya se usan etiquetas en los recipientes). El problema es que la información solo es visible físicamente frente a la nevera/congelador, y las decisiones de qué cocinar o comprar suelen tomarse en otro lugar (supermercado, oficina).

## Alcance funcional (v0)

**Incluye:**

* Registrar entrada: qué es, cuántas porciones, fecha
* Vencimiento automático a 3 meses desde la fecha de entrada
* Registrar salida: qué porción se sacó y cuándo (manual, controlado por el usuario)
* Vista de inventario actual: qué hay, cuántas porciones quedan de cada cosa, cuánto falta para el límite de 3 meses
* Uso compartido: más de una persona de la misma casa puede ver y actualizar el mismo inventario

**Fuera de alcance (v0):**

* Planeación de comidas / sugerencias de qué cocinar
* Descuento automático de porciones por supuestos de consumo
* Recetas
* Usuarios externos fuera del hogar (se evalúa más adelante)

## Riesgos principales

1. **Sostenibilidad del registro:** si no se descuenta cada salida, el inventario deja de ser confiable rápidamente.
2. **Disciplina compartida:** si más de una persona actualiza el inventario, la fricción aparece si no todos registran con la misma constancia.
3. **Expansión futura:** otras personas interesadas (ej. compañeros de oficina) pueden tener un dolor distinto (olvido) al del usuario original (visibilidad remota), lo que puede requerir un enfoque diferente si se decide expandir.

## Siguiente paso para validar

Durante una semana, registrar en una nota del celular cada entrada y cada salida (con número de porciones), en vez de usar la etiqueta física del recipiente. Si el hábito se sostiene toda la semana sin saltarse registros, el modelo de registro manual funciona y se puede construir con confianza sobre esa base.

## Próxima etapa del reto

**Cowork:** definir el esquema de datos (estructura de "producto", "entrada", "salida") y preparar los insumos base para pasar a Claude Design (interfaz) y Claude Code (publicación).

