const ICONS = {
  all:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18" stroke-linecap="round"/></svg>',
  video:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 10l5-3v10l-5-3"/></svg>',
  image:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
  code:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3M14 5l-4 14"/></svg>',
  chat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a8 8 0 11-3.2-6.4L21 4l-1 4.8A8 8 0 0121 12z"/></svg>',
  seo:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.3-4.3"/></svg>',
  audio:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 9v6m3-9v12m3-8v4m-9-1h2m10 0h2"/></svg>',
  design:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="8" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="12" cy="16" r="1.5"/></svg>',
  write:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L20 8l-4-4L4 16v4z"/></svg>',
  marketing:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 11v2a4 4 0 004 4h2l6 4V3l-6 4H7a4 4 0 00-4 4z"/></svg>',
  productivity:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l9 4.5-9 4.5L3 7.5 12 3zM3 12l9 4.5L21 12M3 16.5L12 21l9-4.5"/></svg>',
  business:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path stroke-linecap="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  education:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3L2 8l10 5 10-5-10-5zM6 10v6l6 3 6-3v-6"/></svg>',
  voice:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="12" rx="3"/><path stroke-linecap="round" d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
  data:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="8" ry="3"/><path stroke-linecap="round" d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',
  avatar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path stroke-linecap="round" d="M4 21a8 8 0 0116 0"/></svg>',
  bot:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 12v2m6-2v2M12 3v4" stroke-linecap="round"/></svg>',
}

const TOKENS = [
  { k: 'video', match: /video/i },
  { k: 'image', match: /image|photo|picture|art|visual/i },
  { k: 'code', match: /code|dev|programm|software/i },
  { k: 'chat', match: /chat/i },
  { k: 'seo', match: /seo|search|keyword/i },
  { k: 'audio', match: /audio|music/i },
  { k: 'voice', match: /voice|speech|speak/i },
  { k: 'design', match: /design|ui|ux|brand|logo/i },
  { k: 'write', match: /writ|content|copy|article|blog|text/i },
  { k: 'marketing', match: /market|social|ad|campaign/i },
  { k: 'productivity', match: /productiv|task|automation|workflow|notes/i },
  { k: 'business', match: /business|finance|legal|hr|sales/i },
  { k: 'education', match: /educat|learn|study|course|tutor/i },
  { k: 'data', match: /data|analyt|insight|chart/i },
  { k: 'avatar', match: /avatar|face|human|character|persona/i },
  { k: 'bot', match: /bot|assist|agent/i },
]

export function useCategoryIcon() {
  const resolve = (handleOrName = '') => {
    const s = String(handleOrName).toLowerCase()
    if (!s || s === 'all') return ICONS.all
    for (const t of TOKENS) {
      if (t.match.test(s)) return ICONS[t.k]
    }
    return ICONS.bot
  }
  return { resolve, ICONS }
}
