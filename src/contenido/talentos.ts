// Árbol de talentos: 3 sendas × 3 niveles. Cada nivel de la partida da 1 punto de talento.
// Para aprender un talento de nivel N hace falta el de nivel N−1 de la misma senda.

export type IdTalento =
  | "remate" | "cuartoCorte" | "sedSangre"
  | "saltoPared" | "ligereza" | "embestidaDoble"
  | "ecoTecnica" | "resonanciaProfunda" | "golpeEter";

export type Senda = "filo" | "vendaval" | "eco";

export interface DefTalento {
  readonly id: IdTalento;
  readonly senda: Senda;
  readonly grado: 1 | 2 | 3;
  readonly nombre: string;
  readonly descripcion: string;
}

export const SENDAS: Readonly<Record<Senda, { nombre: string; color: string; lema: string }>> = {
  filo: { nombre: "Senda del Filo", color: "#ff6a6a", lema: "Golpear más, golpear mejor." },
  vendaval: { nombre: "Senda del Vendaval", color: "#7fe3ff", lema: "Nadie atrapa al viento." },
  eco: { nombre: "Senda del Eco", color: "#c9a7ff", lema: "Las almas responden a quien las escucha." },
};

export const TALENTOS: readonly DefTalento[] = [
  { id: "remate", senda: "filo", grado: 1, nombre: "Remate", descripcion: "El último golpe del combo hace +40 % de daño y aturde medio segundo." },
  { id: "cuartoCorte", senda: "filo", grado: 2, nombre: "Corte Final", descripcion: "Tu combo gana un golpe extra: un giro que corta a ambos lados (×2 de daño)." },
  { id: "sedSangre", senda: "filo", grado: 3, nombre: "Sed de Sangre", descripcion: "Tus golpes y patadas te curan un 5 % del daño que hacen." },
  { id: "saltoPared", senda: "vendaval", grado: 1, nombre: "Salto de Pared", descripcion: "Deslízate por las paredes y salta desde ellas." },
  { id: "ligereza", senda: "vendaval", grado: 2, nombre: "Ligereza", descripcion: "+15 % de velocidad y saltos más altos." },
  { id: "embestidaDoble", senda: "vendaval", grado: 3, nombre: "Doble Embestida", descripcion: "La Embestida tiene 2 cargas y hace daño a lo que atraviesa." },
  { id: "ecoTecnica", senda: "eco", grado: 1, nombre: "Eco de Técnica", descripcion: "Tus técnicas cuestan un 25 % menos de éter." },
  { id: "resonanciaProfunda", senda: "eco", grado: 2, nombre: "Resonancia Profunda", descripcion: "Las Resonancias aportan +15 % más de sus stats." },
  { id: "golpeEter", senda: "eco", grado: 3, nombre: "Golpe de Éter", descripcion: "El último golpe del combo lanza una onda de éter que atraviesa enemigos." },
];

export function talento(id: IdTalento): DefTalento {
  return TALENTOS.find((t) => t.id === id)!;
}
