export function PortalIcon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "home" ? <><path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/></> :
      name === "info" ? <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></> :
      name === "user" ? <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> :
      name === "login" ? <><path d="M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4"/></> :
      name === "calendar" ? <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2m-8 3h2"/></> :
      name === "help" ? <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/></> :
      name === "news" ? <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v4H7zm8 0h2m-2 4h2M7 16h10"/></> :
      name === "ticket" ? <><path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4Z"/><path d="M15 7v2m0 3v1m0 3v1"/></> :
      name === "list" ? <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></> :
      name === "pin" ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></> :
      name === "search" ? <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></> :
      name === "clock" ? <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></> :
      name === "pause" ? <><path d="M8 5v14M16 5v14" strokeWidth="3"/></> :
      name === "play" ? <path d="m9 5 10 7-10 7Z"/> :
      name === "left" ? <path d="m14 6-6 6 6 6"/> :
      name === "right" ? <path d="m10 6 6 6-6 6"/> :
      name === "check" ? <path d="m5 12 4 4L19 6"/> :
      name === "arrow" ? <path d="M5 12h14m-6-6 6 6-6 6"/> :
      <><path d="m4 18 14-14M7 4h11v11"/></>}
  </svg>;
}
