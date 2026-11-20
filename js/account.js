// Quem está a usar a app: tem conta (entrou com Google, ou já tinha o GitHub ligado),
// é convidado (só pode descobrir e ver detalhes) ou ainda não escolheu (vê o ecrã de entrada).

import { state } from './store.js';
import { provider } from './sync.js';

/** 'account' | 'guest' | 'welcome' */
export function access() {
  if (provider()) return 'account';
  return state.cfg.guest ? 'guest' : 'welcome';
}
export const hasAccount = () => access() === 'account';

/** Ecrãs que precisam de conta: a lista, a agenda e tudo o que é calculado a partir dela. */
export const LOCKED = new Set(['library', 'agenda', 'stats', 'tiers', 'roulette', 'wrapped']);
