const SHANGHAI = 'Asia/Shanghai';

export function nowText() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: SHANGHAI, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

export function todayText() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: SHANGHAI, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
