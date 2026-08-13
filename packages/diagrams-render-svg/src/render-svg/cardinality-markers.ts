import type { Cardinality, EdgeCardinality } from "@kekonic/diagrams-core";

/**
 * Crow's-foot / IE-style relationship markers for ERD edges.
 * Classic IE notation: bar = mandatory, circle = optional, crow's foot = many.
 */
export function cardinalityMarkerDefs(): string {
  const sides: Array<{ id: string; kind: Cardinality; mirror: boolean }> = [
    { id: "flow-card-one", kind: "one", mirror: false },
    { id: "flow-card-zeroOrOne", kind: "zeroOrOne", mirror: false },
    { id: "flow-card-oneOrMany", kind: "oneOrMany", mirror: false },
    { id: "flow-card-zeroOrMany", kind: "zeroOrMany", mirror: false },
    { id: "flow-card-one-start", kind: "one", mirror: true },
    { id: "flow-card-zeroOrOne-start", kind: "zeroOrOne", mirror: true },
    { id: "flow-card-oneOrMany-start", kind: "oneOrMany", mirror: true },
    { id: "flow-card-zeroOrMany-start", kind: "zeroOrMany", mirror: true },
  ];

  let out = "";
  for (const side of sides) {
    out += `<marker id="${side.id}" markerWidth="16" markerHeight="12" refX="${side.mirror ? 1 : 15}" refY="6" orient="auto" markerUnits="userSpaceOnUse">`;
    out += markerGeometry(side.kind, side.mirror);
    out += `</marker>`;
  }
  return out;
}

function markerGeometry(kind: Cardinality, mirror: boolean): string {
  const tip = mirror ? 1 : 15;
  const dir = mirror ? 1 : -1;
  const stroke =
    'stroke="var(--kd-edge)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  const fillCircle =
    'fill="var(--kd-table-fill, var(--kd-bg))" stroke="var(--kd-edge)" stroke-width="1.35"';

  let g = "";

  if (kind === "one") {
    // Exactly-one: two parallel bars near the tip.
    const b1 = tip + dir * 4;
    const b2 = tip + dir * 7;
    g += `<line x1="${b1}" y1="1.5" x2="${b1}" y2="10.5" ${stroke}/>`;
    g += `<line x1="${b2}" y1="1.5" x2="${b2}" y2="10.5" ${stroke}/>`;
    return g;
  }

  if (kind === "zeroOrOne") {
    // Optional one: circle then single bar.
    const cx = tip + dir * 3;
    const bar = tip + dir * 7;
    g += `<circle cx="${cx}" cy="6" r="2.2" ${fillCircle}/>`;
    g += `<line x1="${bar}" y1="1.5" x2="${bar}" y2="10.5" ${stroke}/>`;
    return g;
  }

  if (kind === "oneOrMany") {
    // Mandatory many: bar then crow's foot at tip.
    const bar = tip + dir * 10;
    const crow = tip + dir * 4;
    g += `<line x1="${bar}" y1="1.5" x2="${bar}" y2="10.5" ${stroke}/>`;
    g += `<path d="M ${tip} 6 L ${crow} 1.2 M ${tip} 6 L ${crow} 6 M ${tip} 6 L ${crow} 10.8" ${stroke}/>`;
    return g;
  }

  // zeroOrMany: circle then crow's foot.
  const cx = tip + dir * 3.2;
  const crow = tip + dir * 9;
  g += `<circle cx="${cx}" cy="6" r="2.2" ${fillCircle}/>`;
  g += `<path d="M ${tip} 6 L ${crow} 1.2 M ${tip} 6 L ${crow} 6 M ${tip} 6 L ${crow} 10.8" ${stroke}/>`;
  return g;
}

export function cardinalityMarkerIds(c: EdgeCardinality): {
  markerStart: string;
  markerEnd: string;
} {
  return {
    markerStart: `flow-card-${c.from}-start`,
    markerEnd: `flow-card-${c.to}`,
  };
}
