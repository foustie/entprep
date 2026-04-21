export interface Region {
  id: string;
  name: string;
  name_kk: string;
}

export const REGIONS: Region[] = [
  { id: 'almaty_city', name: 'Алматы', name_kk: 'Алматы' },
  { id: 'astana_city', name: 'Астана', name_kk: 'Астана' },
  { id: 'shymkent_city', name: 'Шымкент', name_kk: 'Шымкент' },
  { id: 'almaty_obl', name: 'Алматинская область', name_kk: 'Алматы облысы' },
  { id: 'aqmola', name: 'Акмолинская область', name_kk: 'Ақмола облысы' },
  { id: 'aqtobe', name: 'Актюбинская область', name_kk: 'Ақтөбе облысы' },
  { id: 'atyrau', name: 'Атырауская область', name_kk: 'Атырау облысы' },
  { id: 'bko', name: 'Западно-Казахстанская область', name_kk: 'Батыс Қазақстан облысы' },
  { id: 'zhetysu', name: 'Жетысуская область', name_kk: 'Жетісу облысы' },
  { id: 'zhambyl', name: 'Жамбылская область', name_kk: 'Жамбыл облысы' },
  { id: 'karaganda', name: 'Карагандинская область', name_kk: 'Қарағанды облысы' },
  { id: 'kostanay', name: 'Костанайская область', name_kk: 'Қостанай облысы' },
  { id: 'kyzylorda', name: 'Кызылординская область', name_kk: 'Қызылорда облысы' },
  { id: 'mangystau', name: 'Мангистауская область', name_kk: 'Маңғыстау облысы' },
  { id: 'pavlodar', name: 'Павлодарская область', name_kk: 'Павлодар облысы' },
  { id: 'sko', name: 'Северо-Казахстанская область', name_kk: 'Солтүстік Қазақстан облысы' },
  { id: 'turkestan', name: 'Туркестанская область', name_kk: 'Түркістан облысы' },
  { id: 'ulytau', name: 'Улытауская область', name_kk: 'Ұлытау облысы' },
  { id: 'vko', name: 'Восточно-Казахстанская область', name_kk: 'Шығыс Қазақстан облысы' },
  { id: 'abai', name: 'Область Абай', name_kk: 'Абай облысы' },
];

export function getRegionName(id: string, lang: 'ru' | 'kk' = 'ru'): string {
  const r = REGIONS.find(r => r.id === id);
  return r ? (lang === 'kk' ? r.name_kk : r.name) : id;
}
