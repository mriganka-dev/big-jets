// Mapping of common ICAO airline codes to Airline metadata
export const AIRLINES = {
  THA: { name: "Thai Airways", iata: "TG", country: "Thailand", callsign: "THAI" },
  AIC: { name: "Air India", iata: "AI", country: "India", callsign: "AIRINDIA" },
  IGO: { name: "IndiGo", iata: "6E", country: "India", callsign: "IFLY" },
  AXB: { name: "Air India Express", iata: "IX", country: "India", callsign: "EXPRESS INDIA" },
  SEJ: { name: "SpiceJet", iata: "SG", country: "India", callsign: "SPICEJET" },
  VTI: { name: "Vistara", iata: "UK", country: "India", callsign: "VISTARA" },
  AKJ: { name: "Akasa Air", iata: "QP", country: "India", callsign: "AKASA AIR" },
  GOI: { name: "Go First", iata: "G8", country: "India", callsign: "GOAIR" },
  UAE: { name: "Emirates", iata: "EK", country: "United Arab Emirates", callsign: "EMIRATES" },
  ETD: { name: "Etihad Airways", iata: "EY", country: "United Arab Emirates", callsign: "ETIHAD" },
  FDB: { name: "flydubai", iata: "FZ", country: "United Arab Emirates", callsign: "SKYDUBAI" },
  QTR: { name: "Qatar Airways", iata: "QR", country: "Qatar", callsign: "QATARI" },
  SVA: { name: "Saudia", iata: "SV", country: "Saudi Arabia", callsign: "SAUDIA" },
  GFA: { name: "Gulf Air", iata: "GF", country: "Bahrain", callsign: "GULF AIR" },
  OMA: { name: "Oman Air", iata: "WY", country: "Oman", callsign: "OMAN AIR" },
  KAC: { name: "Kuwait Airways", iata: "KU", country: "Kuwait", callsign: "KUWAITI" },
  DLH: { name: "Lufthansa", iata: "LH", country: "Germany", callsign: "LUFTHANSA" },
  BAW: { name: "British Airways", iata: "BA", country: "United Kingdom", callsign: "SPEEDBIRD" },
  AFR: { name: "Air France", iata: "AF", country: "France", callsign: "AIRFRANS" },
  KLM: { name: "KLM Royal Dutch Airlines", iata: "KL", country: "Netherlands", callsign: "KLM" },
  VIR: { name: "Virgin Atlantic", iata: "VS", country: "United Kingdom", callsign: "VIRGIN" },
  SWR: { name: "Swiss International Air Lines", iata: "LX", country: "Switzerland", callsign: "SWISS" },
  AUA: { name: "Austrian Airlines", iata: "OS", country: "Austria", callsign: "AUSTRIAN" },
  SAS: { name: "SAS Scandinavian Airlines", iata: "SK", country: "Sweden", callsign: "SCANDINAVIAN" },
  FIN: { name: "Finnair", iata: "AY", country: "Finland", callsign: "FINNAIR" },
  IBE: { name: "Iberia", iata: "IB", country: "Spain", callsign: "IBERIA" },
  TAP: { name: "TAP Air Portugal", iata: "TP", country: "Portugal", callsign: "AIR PORTUGAL" },
  THY: { name: "Turkish Airlines", iata: "TK", country: "Turkey", callsign: "TURKISH" },
  SIA: { name: "Singapore Airlines", iata: "SQ", country: "Singapore", callsign: "SINGAPORE" },
  MAS: { name: "Malaysia Airlines", iata: "MH", country: "Malaysia", callsign: "MALAYSIAN" },
  CPA: { name: "Cathay Pacific", iata: "CX", country: "Hong Kong", callsign: "CATHAY" },
  CAL: { name: "China Airlines", iata: "CI", country: "Taiwan", callsign: "DYNASTY" },
  EVA: { name: "EVA Air", iata: "BR", country: "Taiwan", callsign: "EVA" },
  JAL: { name: "Japan Airlines", iata: "JL", country: "Japan", callsign: "JAPANAIR" },
  ANA: { name: "All Nippon Airways", iata: "NH", country: "Japan", callsign: "ALL NIPPON" },
  KAL: { name: "Korean Air", iata: "KE", country: "South Korea", callsign: "KOREANAIR" },
  AAR: { name: "Asiana Airlines", iata: "OZ", country: "South Korea", callsign: "ASIANA" },
  CCA: { name: "Air China", iata: "CA", country: "China", callsign: "AIR CHINA" },
  CES: { name: "China Eastern Airlines", iata: "MU", country: "China", callsign: "CHINA EASTERN" },
  CSN: { name: "China Southern Airlines", iata: "CZ", country: "China", callsign: "CHINA SOUTHERN" },
  CHH: { name: "Hainan Airlines", iata: "HU", country: "China", callsign: "HAINAN" },
  VJC: { name: "VietJet Air", iata: "VJ", country: "Vietnam", callsign: "VIETJET" },
  HVN: { name: "Vietnam Airlines", iata: "VN", country: "Vietnam", callsign: "VIET NAM AIRLINES" },
  GIA: { name: "Garuda Indonesia", iata: "GA", country: "Indonesia", callsign: "INDONESIA" },
  LNI: { name: "Lion Air", iata: "JT", country: "Indonesia", callsign: "LION INTER" },
  QFA: { name: "Qantas", iata: "QF", country: "Australia", callsign: "QANTAS" },
  VOZ: { name: "Virgin Australia", iata: "VA", country: "Australia", callsign: "VELOCITY" },
  ANZ: { name: "Air New Zealand", iata: "NZ", country: "New Zealand", callsign: "NEW ZEALAND" },
  UAL: { name: "United Airlines", iata: "UA", country: "United States", callsign: "UNITED" },
  AAL: { name: "American Airlines", iata: "AA", country: "United States", callsign: "AMERICAN" },
  DAL: { name: "Delta Air Lines", iata: "DL", country: "United States", callsign: "DELTA" },
  SWA: { name: "Southwest Airlines", iata: "WN", country: "United States", callsign: "SOUTHWEST" },
  JBU: { name: "JetBlue Airways", iata: "B6", country: "United States", callsign: "JETBLUE" },
  ASA: { name: "Alaska Airlines", iata: "AS", country: "United States", callsign: "ALASKA" },
  FDX: { name: "FedEx Express", iata: "FX", country: "United States", callsign: "FEDEX" },
  UPS: { name: "UPS Airlines", iata: "5X", country: "United States", callsign: "UPS" },
  ACA: { name: "Air Canada", iata: "AC", country: "Canada", callsign: "AIR CANADA" },
  AMX: { name: "Aeromexico", iata: "AM", country: "Mexico", callsign: "AEROMEXICO" },
  EZY: { name: "easyJet", iata: "U2", country: "United Kingdom", callsign: "EASY" },
  RYR: { name: "Ryanair", iata: "FR", country: "Ireland", callsign: "RYANAIR" },
  WZZ: { name: "Wizz Air", iata: "W6", country: "Hungary", callsign: "WIZZ AIR" },
  ETH: { name: "Ethiopian Airlines", iata: "ET", country: "Ethiopia", callsign: "ETHIOPIAN" },
  MSR: { name: "EgyptAir", iata: "MS", country: "Egypt", callsign: "EGYPTAIR" },
  RAM: { name: "Royal Air Maroc", iata: "AT", country: "Morocco", callsign: "ROYALAIR MAROC" },
  SAA: { name: "South African Airways", iata: "SA", country: "South Africa", callsign: "SPRINGBOK" },
  RJA: { name: "Royal Jordanian", iata: "RJ", country: "Jordan", callsign: "JORDANIAN" },
  MSR: { name: "EgyptAir", iata: "MS", country: "Egypt", callsign: "EGYPTAIR" },
  LOT: { name: "LOT Polish Airlines", iata: "LO", country: "Poland", callsign: "POLLOT" },
  BTI: { name: "airBaltic", iata: "BT", country: "Latvia", callsign: "AIR BALTIC" },
  AZA: { name: "ITA Airways", iata: "AZ", country: "Italy", callsign: "ITARROW" },
  AEE: { name: "Aegean Airlines", iata: "A3", country: "Greece", callsign: "AEGEAN" },
  ELG: { name: "AlMasria Universal Airlines", iata: "UJ", country: "Egypt", callsign: "ALMASRIA" },
};

/**
 * Returns airline info from callsign or 3-letter ICAO prefix
 */
export function getAirlineByCallsign(callsign) {
  if (!callsign || typeof callsign !== "string") return null;
  const clean = callsign.trim().toUpperCase();
  const match = clean.match(/^([A-Z]{3})/);
  if (!match) return null;
  const icao = match[1];
  const found = AIRLINES[icao];
  if (!found) return null;
  return {
    icao,
    name: found.name,
    iata: found.iata,
    country: found.country,
    callsign: found.callsign,
    logoUrl: `https://images.kiwi.com/airlines/64x64/${found.iata}.png`,
  };
}

/**
 * Helper to get airline logo URL by 2-letter IATA code
 */
export function getAirlineLogoUrl(iata) {
  if (!iata || typeof iata !== "string") return null;
  const clean = iata.trim().toUpperCase();
  return `https://images.kiwi.com/airlines/64x64/${clean}.png`;
}
