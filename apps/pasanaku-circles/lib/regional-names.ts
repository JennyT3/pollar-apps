export type RegionalName = {
  country: string;
  names: string[];
};

export const REGIONAL_NAMES: RegionalName[] = [
  { country: "Argentina", names: ["rueda", "círculo"] },
  { country: "Bolivia", names: ["pasanaku"] },
  { country: "Brasil", names: ["consórcio (formal)", "caixinha (informal)"] },
  { country: "Chile", names: ["polla"] },
  { country: "Colombia", names: ["natillera", "cadena"] },
  { country: "Ecuador", names: ["cadena"] },
  { country: "El Salvador", names: ["cuchubal"] },
  { country: "Guatemala", names: ["cuchubal"] },
  { country: "Haití", names: ["sòl"] },
  { country: "México", names: ["tanda", "cundina (norte)", "rol"] },
  { country: "Perú", names: ["pandero", "junta"] },
  { country: "República Dominicana", names: ["san"] },
  { country: "Venezuela", names: ["san"] },
];

export const CANONICAL_NAME = "pasanaku";
