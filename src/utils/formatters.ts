export function formatDateId(dateInput: string | Date): string {
  const dt = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dt);
}

export function formatDateTimeId(dateInput: string | Date): string {
  const dt = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(dt.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
}

export function toLocalDatetimeInputValue(isoString: string | undefined): string {
  if (!isoString) return '';
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return '';
  // Format as YYYY-MM-DDTHH:mm in Asia/Jakarta
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

export function jakartaInputToIso(inputVal: string): string {
  if (!inputVal) return '';
  return `${inputVal}:00+07:00`;
}
