export const ALLOWED_SPECIALTIES = [
  "Pediatría",
  "Cardiología",
  "Dermatología",
  "Medicina interna",
  "Ginecología y obstetricia",
  "Traumatología y ortopedia",
  "Neurología",
  "Oftalmología",
  "Otorrinolaringología",
  "Psiquiatría",
  "Urología",
  "Endocrinología",
  "Gastroenterología",
  "Medicina familiar",
  "Cirugía general",
  "Neumología",
  "Nefrología",
  "Oncología",
  "Reumatología",
  "Infectología",
  "Geriatría",
  "Alergología",
  "Hematología",
  "Odontología",
] as const;

function specialtyKey(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function canonicalSpecialty(value: string): string | undefined {
  const key = specialtyKey(value);
  return ALLOWED_SPECIALTIES.find((specialty) => specialtyKey(specialty) === key);
}
