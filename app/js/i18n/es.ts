// SPDX-License-Identifier: GPL-3.0-or-later
// Locale es — SEED (só as chaves-piloto; completar UI+Matemática+Lúdico na Etapa 4). Ver docs/plano-i18n.md.
// Parcial de propósito: as chaves ausentes caem no fallback pt (core/i18n).
const es: Record<string, string> = {
  // ===================== ANUNCIOS DE LECTOR DE PANTALLA (`sr.*`) =====================
  // EL MARCO SE TRADUCE; EL CONTENIDO NO. Todo lo que llega por `{param}` pasa sin traducir — nombre de jugador,
  // numero de pantallas y, sobre todo, CONTENIDO CURRICULAR (palabra, silaba, letra, celda braille). El curriculo de
  // alfabetizacion es especifico de cada lengua: el deletreo, la relacion grafema-fonema y la psicogenesis de
  // Ferreiro no se traducen, se reescriben por idioma (ADR-0010, pilar 3). Una clave nueva con contenido curricular
  // dentro es un error.
  'sr.pad.mapSaved': 'Mapeo guardado para: {id}.',
  'sr.pad.assigned': 'Mando asignado al Jugador {n}. El teclado sigue funcionando.',
  'sr.title.waitP1': 'Espera a que el Jugador 1 elija el juego.',
  'sr.player.entered': '¡Jugador {n} entró!',
  'sr.print.on': 'Modo Foto: mira la pantalla sin menús. Aprieta cualquier botón para volver.',
  'sr.player.pressToJoin': 'Jugador {n}: aprieta un botón para entrar.',
  'sr.libras.loading': 'El intérprete de lengua de señas todavía está cargando — inténtalo de nuevo en un momento.',
  'sr.eyes.loadFailed': 'WebGazer no cargó.',
  'sr.eyes.calibrate': 'Jugar con los ojos: mira por la pantalla y haz clic en algunos puntos para calibrar. Mirar izquierda y derecha camina; mirar arriba salta.',
  'sr.eyes.needsInternet': 'No se pudo cargar WebGazer (necesita internet la primera vez).',
  'sr.typo.font': 'Tipografía: {fam}.',
  'sr.visual.contrast': 'Alto contraste: {v}.',
  'sr.visual.lq': 'Realce de contraste: {v}.',
  'sr.gate.open': '¡Portón abierto!',
  'sr.key.taken': '{who}recogió la llave. Toca el portón para abrirlo.',
  'sr.key.returned': 'La llave volvió a su lugar de origen.',
  'sr.power.swapHint': '{msg} (Cambiar poder alterna entre los que ya tienes.)',

  'sr.round.multi': '{n} jugadores, cada uno en su pantalla. Corran por las monedas.',
  'sr.round.somasub': 'Modo Suma y Resta. Toca las figuras y resuelve las cuentas.',
  'sr.round.silabas': 'Modo Sílabas. Toca las letras y arma las palabras.',
  'sr.round.ludico': 'Nueva ronda. Junta 10 monedas.',

  'sr.screens.mobileOnly': 'En el celular el juego funciona en una sola pantalla.',
  'sr.screens.alreadyN': '{n} pantallas ya activas.',
  'sr.screens.already1': 'Una pantalla.',
  'sr.screens.wontFitN': 'No caben {n} pantallas en esta ventana — cada pantalla necesita al menos 640 por 360. Agranda la ventana o usa pantalla completa.',
  'sr.screens.wontFitOneMore': 'No cabe una pantalla más en esta ventana — cada pantalla necesita al menos 640 por 360. Agranda la ventana o usa pantalla completa.',
  'sr.screens.activeN': '{n} pantallas activas.',
  'sr.screens.newRoundN': '{n} pantallas activas — nueva ronda.',
  'sr.screens.newRound1': 'Una pantalla — nueva ronda.',
  'sr.screens.maxPlayers': 'Ya son 4 jugadores.',

  'sr.player.restarted': 'Jugador {n} volvió a empezar en esta pantalla.',
  'sr.player.joined': 'Jugador {n} entró al juego en curso.',
  'sr.player.quit': 'Jugador {n} abandonó el juego.',

  // Objetivo del HUD (texto en DOM; el mismo árbol de decisión del anuncio de ronda)
  'hud.objective.multi': '{n} jugadores — carrera por las {alvo} monedas',
  'hud.objective.somasub': 'Resuelve 10 cuentas',
  'hud.objective.silabas': 'Arma 10 palabras',
  'hud.objective.ludico': 'Junta 10 monedas',

  'skip.toGame': 'Saltar al juego',
  'menu.ludico': 'Juego libre',
  'menu.alfabetizacao': 'Alfabetización',
  'menu.matematica': 'Matemáticas',

  // Controles táctiles — las 9 posiciones, las 9 acciones asignables (panel #touchcfg) y los anuncios.
  'touch.slot.up': 'Direccional ↑ (arriba)',
  'touch.slot.down': 'Direccional ↓ (abajo)',
  'touch.slot.left': 'Direccional ← (izquierda)',
  'touch.slot.right': 'Direccional → (derecha)',
  'touch.slot.start': 'START (enter)',
  'touch.slot.b0': 'Botón 0 (abajo)',
  'touch.slot.b1': 'Botón 1 (derecha)',
  'touch.slot.b2': 'Botón 2 (izquierda)',
  'touch.slot.b3': 'Botón 3 (arriba)',
  'touch.slot.fallback': 'Botón',
  'touch.act.left': 'Caminar a la izquierda',
  'touch.act.right': 'Caminar a la derecha',
  'touch.act.up': 'Subir / escalera',
  'touch.act.down': 'Bajar / escalera',
  'touch.act.jump': 'Saltar',
  'touch.act.run': 'Correr / interactuar',
  'touch.act.especial': 'Especial',
  'touch.act.swap': 'Cambiar poder',
  'touch.act.pause': 'Pausar (START)',
  'touch.dir.cross': 'cruceta (D-pad)',
  'touch.dir.stick': 'palanca analógica',
  'sr.touch.slotSet': '{slot}: {acao}.',
  'sr.touch.dirSet': 'Direccional: {tipo}.',
  'sr.touch.presetChild': 'Controles del tamaño de una mano infantil (6 a 12 años).',
  'sr.touch.presetAdult': 'Controles del tamaño de una mano adulta.',
};
export default es;
