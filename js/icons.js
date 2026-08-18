const paths = {
  dashboard: '<path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6ZM13 3v6h8V3h-8Z"/>',
  devocional: '<path d="M12 21s-7-4.35-9.5-8.5C.7 8.9 2.3 5 6 5c2 0 3.5 1.2 4 2.2C10.5 6.2 12 5 14 5c3.7 0 5.3 3.9 3.5 7.5C19 16.65 12 21 12 21Z"/><path d="M12 8v6M9 11h6" stroke-linecap="round"/>',
  casa: '<path d="M4 11.5 12 4l8 7.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M6 10v10h12V10" fill="none"/><path d="M10 20v-6h4v6" fill="none"/>',
  saude: '<path d="M12 12h6M9 9v6" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none"/>',
  estudo: '<path d="M3 6.5 12 3l9 3.5-9 3.5-9-3.5Z" fill="none" stroke-linejoin="round"/><path d="M6 8.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3V8.5" fill="none"/><path d="M21 7v6" stroke-linecap="round"/>',
  trabalho: '<rect x="3" y="7" width="18" height="13" rx="2" fill="none"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none"/><path d="M3 12h18" />',
  financeiro: '<circle cx="12" cy="12" r="9" fill="none"/><path d="M12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.5 6 4.4 0 1.4-1.4 2.3-3 2.3s-3-.9-3-2.3" fill="none" stroke-linecap="round"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2" fill="none"/><path d="M3 10h18M8 3v4M16 3v4" stroke-linecap="round"/>',
  settings: '<circle cx="12" cy="12" r="3" fill="none"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.4.8a8 8 0 0 0-1.7-1L15 3h-6l-.3 2.9a8 8 0 0 0-1.7 1l-2.4-.8-2 3.4L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.4-.8a8 8 0 0 0 1.7 1L9 21h6l.3-2.9a8 8 0 0 0 1.7-1l2.4.8 2-3.4-2-1.5Z" fill="none"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke-linecap="round"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="none"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke-linecap="round"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  play: '<path d="M7 4l13 8-13 8V4Z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  timer: '<circle cx="12" cy="13" r="8" fill="none"/><path d="M12 9v4l3 2M9 2h6" stroke-linecap="round"/>',
  check: '<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z" fill="none" stroke-linejoin="round"/>',
  chevronDown: '<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronLeft: '<path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronRight: '<path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  link: '<path d="M9 15l6-6M8 8l1-1a4 4 0 0 1 6 6l-1 1M16 16l-1 1a4 4 0 0 1-6-6l1-1" fill="none" stroke-linecap="round"/>',
  calendarSync: '<rect x="3" y="5" width="18" height="16" rx="2" fill="none"/><path d="M3 10h18" /><path d="M9 15l2 2 4-4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke-linejoin="round" fill="none"/>',
  flag: '<path d="M5 3v18M5 4h11l-2 4 2 4H5" fill="none" stroke-linejoin="round"/>',
  repeat: '<path d="M4 7h13l-3-3M20 17H7l3 3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  review: '<path d="M4 12a8 8 0 1 1 3 6.2" fill="none" stroke-linecap="round"/><path d="M4 21v-5h5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  qr: '<rect x="4" y="4" width="6" height="6" fill="none"/><rect x="14" y="4" width="6" height="6" fill="none"/><rect x="4" y="14" width="6" height="6" fill="none"/><path d="M14 14h3v3M20 14v3h-3M14 20h6" fill="none"/>',
  user: '<circle cx="12" cy="8" r="4" fill="none"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" fill="none" stroke-linecap="round"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" fill="none" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none"/>',
};

export function icon(name, cls = "icon") {
  const p = paths[name] || paths.dashboard;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${p}</svg>`;
}
