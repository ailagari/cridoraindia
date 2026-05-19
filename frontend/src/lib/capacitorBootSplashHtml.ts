/** Injected into index.html for Capacitor builds — instant glow before JS bundle loads. */
export const CAPACITOR_BOOT_SPLASH_HTML = `
<style id="cridora-boot-splash-style">
@keyframes native-app-splash-self-glow{0%,100%{filter:drop-shadow(0 0 3px rgba(255,255,255,.15)) drop-shadow(0 0 8px rgba(212,168,92,.2)) drop-shadow(0 0 18px rgba(166,122,40,.1))}50%{filter:drop-shadow(0 0 8px rgba(255,255,255,.4)) drop-shadow(0 0 20px rgba(212,168,92,.35)) drop-shadow(0 0 35px rgba(166,122,40,.2))}}
@keyframes native-app-splash-backside-glow{0%,100%{opacity:.25;transform:scale(.95)}50%{opacity:.55;transform:scale(1.15)}}
#cridora-boot-splash{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#000814}
#cridora-boot-splash .native-app-splash__logo-stage{position:relative;width:11rem;height:11rem;display:flex;align-items:center;justify-content:center}
#cridora-boot-splash .native-app-splash__backside-glow{position:absolute;top:-25%;left:-25%;width:150%;height:150%;border-radius:50%;background:radial-gradient(circle,rgba(224,188,120,.45) 0%,rgba(166,122,40,.15) 50%,rgba(0,0,0,0) 70%);filter:blur(24px);pointer-events:none;z-index:0;animation:native-app-splash-backside-glow 4s ease-in-out infinite}
#cridora-boot-splash .native-app-splash__logo-glow{position:relative;z-index:1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;animation:native-app-splash-self-glow 4s ease-in-out infinite}
</style>
<div id="cridora-boot-splash" role="status" aria-label="Loading Cridora India">
  <div class="native-app-splash__logo-stage">
    <div class="native-app-splash__backside-glow" aria-hidden="true"></div>
    <div class="native-app-splash__logo-glow">
      <svg width="160" height="160" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="18" stroke="url(#cridoraBootGold)" stroke-width="2.5"></circle>
        <path d="M14 20C14 16.6863 16.6863 14 20 14" stroke="#d4a85c" stroke-width="3" stroke-linecap="round"></path>
        <path d="M26 20C26 23.3137 23.3137 26 20 26" stroke="#a67a28" stroke-width="3" stroke-linecap="round"></path>
        <defs>
          <linearGradient id="cridoraBootGold" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#e0bc78"></stop>
            <stop offset="55%" stop-color="#a67a28"></stop>
            <stop offset="100%" stop-color="#5c2f0a"></stop>
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
</div>
`.trim()
