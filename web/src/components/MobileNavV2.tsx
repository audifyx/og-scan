export function MobileNav({ onOpenPanel }: { onOpenPanel: (tab: 'my' | 'chat' | 'lib') => void }) {
  return (
    <>
      <style>{mnv2CSS}</style>
      <nav className="mnv2">
        <button className="mnv2-card" onClick={() => onOpenPanel('my')}>
          <span className="mnv2-ci mnv2-ci--blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>
          </span>
          <span className="mnv2-ct">
            <span className="mnv2-ct-t">My Widgets</span>
            <span className="mnv2-ct-s">Widgets you built</span>
          </span>
        </button>
        <button className="mnv2-plus" onClick={() => onOpenPanel('chat')} aria-label="Create widget">
          <span className="mnv2-plus-ring" />
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11H13V5a1 1 0 00-2 0v6H5a1 1 0 000 2h6v6a1 1 0 002 0v-6h6a1 1 0 000-2z"/></svg>
        </button>
        <button className="mnv2-card" onClick={() => onOpenPanel('lib')}>
          <span className="mnv2-ci mnv2-ci--purple">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="16" rx="1.5"/><path d="M17.2 5.1l3.1 15.1a1 1 0 01-.78 1.18l-.98.2a1 1 0 01-1.18-.78L14.46 5.9a1 1 0 01.78-1.18l.98-.2a1 1 0 011.18.78z"/></svg>
          </span>
          <span className="mnv2-ct">
            <span className="mnv2-ct-t">Library</span>
            <span className="mnv2-ct-s">Pre-built widgets</span>
          </span>
        </button>
      </nav>
    </>
  );
}

const mnv2CSS = `
/* ─── MobileNavV2: glassmorphism widget nav ─── */
.mnv2{display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;padding:14px 10px max(14px,env(safe-area-inset-bottom,14px));justify-content:center;align-items:center;gap:0;background:transparent;pointer-events:none}
@media(max-width:767px){.mnv2{display:flex}}
.mnv2-card{pointer-events:auto;display:flex;align-items:center;gap:10px;padding:14px;background:rgba(10,14,24,.82);backdrop-filter:blur(28px) saturate(180%);-webkit-backdrop-filter:blur(28px) saturate(180%);border:1px solid rgba(255,255,255,.09);border-radius:18px;text-decoration:none;min-width:0;flex:1;max-width:172px;transition:all .2s;cursor:pointer;font-family:inherit;text-align:left}
.mnv2-card:first-child{border-top-right-radius:8px;border-bottom-right-radius:8px;margin-right:-4px}
.mnv2-card:last-child{border-top-left-radius:8px;border-bottom-left-radius:8px;margin-left:-4px}
.mnv2-card:hover{border-color:rgba(90,162,255,.28);background:rgba(10,14,24,.92)}
.mnv2-card:active{transform:scale(.97)}
.mnv2-ci{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex-shrink:0}
.mnv2-ci--blue{background:rgba(47,128,255,.18);color:#5aa2ff;box-shadow:0 0 14px rgba(47,128,255,.22)}
.mnv2-ci--purple{background:rgba(153,69,255,.16);color:#b07aff;box-shadow:0 0 14px rgba(153,69,255,.2)}
.mnv2-ct{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.mnv2-ct-t{font-size:13px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mnv2-ct-s{font-size:9px;font-weight:600;color:rgba(255,255,255,.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.02em}
.mnv2-plus{pointer-events:auto;position:relative;width:68px;height:68px;border-radius:20px;background:rgba(8,10,18,.92);border:none;cursor:pointer;display:grid;place-items:center;color:#fff;flex-shrink:0;z-index:2;transition:all .25s;font-family:inherit}
.mnv2-plus-ring{position:absolute;inset:-3px;border-radius:23px;background:conic-gradient(from 180deg,#2F80FF,#7B61FF,#9945FF,#7B61FF,#2F80FF);opacity:.85;z-index:-1;filter:blur(0.5px)}
.mnv2-plus::before{content:'';position:absolute;inset:0;border-radius:20px;background:rgba(8,10,18,.92);z-index:-1}
.mnv2-plus::after{content:'';position:absolute;inset:-8px;border-radius:28px;background:radial-gradient(circle,rgba(47,128,255,.28) 0%,rgba(153,69,255,.12) 50%,transparent 70%);z-index:-2;pointer-events:none}
.mnv2-plus:hover{transform:scale(1.06)}
.mnv2-plus:active{transform:scale(.98)}
.mnv2-plus:hover .mnv2-plus-ring{opacity:1;filter:blur(0px)}
/* Hide old mob-nav from AIWidgetPanel when V2 is active */
.mob-nav{display:none!important}
`;
