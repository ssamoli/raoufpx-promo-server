<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>RAOUF px — Private Portrait Session</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex,nofollow"/>
  <link rel="icon" href="favicon.ico" type="image/x-icon"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"/>
  <style>
    /* ── RESET ── */
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#080810;--surface:rgba(255,255,255,.04);--surface2:rgba(255,255,255,.07);
      --accent:#f0b44c;--accent2:#ff7e3e;--accent3:#4cf0d0;
      --muted:rgba(255,255,255,.45);--text:rgba(255,255,255,.82);
      --radius:6px;
    }
    html{scroll-behavior:smooth}
    html,body{min-height:100%;background:var(--bg);color:var(--text);font-family:'Space Mono',monospace;overflow-x:hidden;cursor:none}

    /* CRT scanlines */
    body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.09) 2px,rgba(0,0,0,.09) 4px);pointer-events:none;z-index:8000;opacity:.4}
    /* pixel grid */
    body::after{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(240,180,76,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(240,180,76,.018) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0}

    /* ── CURSOR ── */
    .cursor{position:fixed;pointer-events:none;z-index:9999;transform:translate(-50%,-50%)}
    .cursor-inner{width:12px;height:12px;background:var(--accent);clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);animation:cpulse 1.5s ease-in-out infinite}
    .cursor-outer{position:fixed;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);width:28px;height:28px;border:2px solid rgba(240,180,76,.35);clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);transition:width .2s,height .2s}
    body:has(a:hover) .cursor-outer,body:has(button:hover) .cursor-outer{width:42px;height:42px;border-color:var(--accent)}
    @keyframes cpulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.82)}}

    /* ── GLOWS ── */
    .glow{position:fixed;border-radius:50%;pointer-events:none;z-index:0;filter:blur(120px);opacity:.05}
    .glow-1{width:500px;height:500px;background:#f0b44c;top:-150px;left:-100px;animation:g1 24s ease-in-out infinite alternate}
    .glow-2{width:400px;height:400px;background:#4cf0d0;bottom:-80px;right:-80px;animation:g2 30s ease-in-out infinite alternate}
    @keyframes g1{to{transform:translate(60px,40px)}}
    @keyframes g2{to{transform:translate(-50px,-60px)}}

    /* ── GATE ── */
    #content{opacity:0;pointer-events:none;position:relative;z-index:1;transition:opacity .4s}
    #content.unlocked{opacity:1;pointer-events:auto}
    #gate-spinner{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:var(--bg)}
    #gate-spinner p{font-family:'Press Start 2P',monospace;font-size:.4rem;color:var(--accent3);letter-spacing:.2em;animation:blink .8s steps(1) infinite}
    #gate-spinner.hidden{display:none}

    /* ── LAYOUT ── */
    .page-wrap{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:0 clamp(1.2rem,5vw,2.5rem) 6rem}

    /* ── LOGO BAR ── */
    .logo-bar{display:flex;justify-content:center;padding:2.5rem 0 3rem;position:relative;z-index:1}
    .logo-frame{display:inline-flex;align-items:center;text-decoration:none;padding:8px;border:2px solid rgba(240,180,76,.2);position:relative;transition:border-color .2s}
    .logo-frame:hover{border-color:var(--accent)}
    .logo-frame::before,.logo-frame::after{content:'';position:absolute;width:7px;height:7px;background:var(--accent)}
    .logo-frame::before{top:-3px;left:-3px}.logo-frame::after{bottom:-3px;right:-3px}
    .logo-frame img{height:2rem;width:auto;filter:drop-shadow(0 0 12px rgba(240,180,76,.5))}

    /* ── SHARED ── */
    .section-label{font-family:'Press Start 2P',monospace;font-size:.32rem;color:var(--accent3);letter-spacing:.22em;display:block;margin-bottom:1.4rem}
    .section-label::before{content:'> ';color:var(--accent)}
    .sec{margin-bottom:4rem}
    .ping-dot{width:7px;height:7px;border-radius:50%;background:var(--accent3);box-shadow:0 0 8px var(--accent3);animation:pingpulse 1.6s ease-in-out infinite;flex-shrink:0}
    @keyframes pingpulse{0%,100%{box-shadow:0 0 4px var(--accent3)}50%{box-shadow:0 0 16px var(--accent3),0 0 28px rgba(76,240,208,.2)}}

    /* ══════════════════════════════
       1. HERO
    ══════════════════════════════ */
    .hero{text-align:center;padding:0 0 4rem}
    .hero-status{display:inline-flex;align-items:center;gap:.6rem;font-family:'Press Start 2P',monospace;font-size:.28rem;color:rgba(76,240,208,.6);letter-spacing:.16em;margin-bottom:2rem}
    .hero-h1{font-family:'Press Start 2P',monospace;font-size:clamp(1rem,4vw,1.7rem);color:#fff;line-height:1.8;text-shadow:3px 3px 0 rgba(240,180,76,.12);margin-bottom:1.2rem}
    .hero-sub{font-family:'Space Mono',monospace;font-size:clamp(.82rem,2vw,.95rem);color:var(--muted);line-height:2.1;max-width:480px;margin:0 auto 2.8rem;font-style:italic}

    /* ── Pricing card ── */
    .price-card{display:inline-flex;flex-direction:column;align-items:center;background:var(--surface);border:2px solid rgba(240,180,76,.2);padding:2.2rem 3rem;position:relative}
    .price-card::before{content:'';position:absolute;top:-2px;left:-2px;width:20px;height:20px;border-top:2px solid var(--accent);border-left:2px solid var(--accent)}
    .price-card::after{content:'';position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;border-bottom:2px solid var(--accent2);border-right:2px solid var(--accent2)}
    .price-card-label{font-family:'Press Start 2P',monospace;font-size:.28rem;color:rgba(255,255,255,.25);letter-spacing:.18em;margin-bottom:1.6rem}
    .price-cols{display:flex;align-items:center;gap:1.6rem;flex-wrap:wrap;justify-content:center;margin-bottom:1rem}
    .price-col{display:flex;flex-direction:column;align-items:center;gap:.5rem}
    .price-col-lbl{font-family:'Press Start 2P',monospace;font-size:.26rem;color:rgba(255,255,255,.25);letter-spacing:.12em}
    .price-was{font-family:'Press Start 2P',monospace;font-size:1rem;color:rgba(255,255,255,.16);text-decoration:line-through}
    .price-arrow{font-family:'Press Start 2P',monospace;font-size:.5rem;color:rgba(255,255,255,.12);padding-top:1.4rem}
    .price-now{font-family:'Press Start 2P',monospace;font-size:clamp(1.7rem,6vw,2.5rem);color:var(--accent);text-shadow:3px 3px 0 rgba(240,120,30,.25),0 0 28px rgba(240,180,76,.2)}
    .price-badge{font-family:'Press Start 2P',monospace;font-size:.28rem;background:var(--accent2);color:#fff;padding:.3rem .7rem;letter-spacing:.08em;margin-top:.6rem}
    .price-note{font-family:'Press Start 2P',monospace;font-size:.26rem;color:rgba(240,180,76,.4);letter-spacing:.1em;margin-top:1.1rem}
    .price-note::before{content:'⚠ ';color:var(--accent2)}

    /* ══════════════════════════════
       2. COUNTDOWN
    ══════════════════════════════ */
    .countdown-block{margin:0 0 4rem;padding:1.6rem;border:1px solid rgba(255,126,62,.28);background:rgba(255,126,62,.03);position:relative;text-align:center}
    .countdown-block::before{content:'';position:absolute;top:-1px;left:-1px;width:13px;height:13px;border-top:2px solid var(--accent2);border-left:2px solid var(--accent2)}
    .countdown-block::after{content:'';position:absolute;bottom:-1px;right:-1px;width:13px;height:13px;border-bottom:2px solid var(--accent2);border-right:2px solid var(--accent2)}
    .cd-label{font-family:'Press Start 2P',monospace;font-size:.3rem;color:var(--accent2);letter-spacing:.16em;margin-bottom:1rem;display:block}
    .cd-label::before{content:'⏱ '}
    .cd-digits{display:flex;align-items:center;justify-content:center;gap:.6rem;flex-wrap:wrap}
    .cd-unit{display:flex;flex-direction:column;align-items:center;gap:.35rem}
    .cd-num{font-family:'Press Start 2P',monospace;font-size:clamp(1.2rem,5vw,2rem);color:var(--accent2);text-shadow:0 0 18px rgba(255,126,62,.4),2px 2px 0 rgba(255,126,62,.2);line-height:1;min-width:2.2ch;text-align:center}
    .cd-lbl{font-family:'Press Start 2P',monospace;font-size:.25rem;color:rgba(255,126,62,.4);letter-spacing:.1em}
    .cd-sep{font-family:'Press Start 2P',monospace;font-size:1.5rem;color:rgba(255,126,62,.35);padding-bottom:1.1rem;animation:blink .9s steps(1) infinite}
    .cd-expired{font-family:'Press Start 2P',monospace;font-size:.38rem;color:var(--accent2);display:none}
    .scarcity{margin-top:1.2rem;padding:.8rem 1.1rem;border:1px solid rgba(240,180,76,.08);background:rgba(240,180,76,.025);text-align:left}
    .scarcity-text{font-family:'Press Start 2P',monospace;font-size:.27rem;color:rgba(240,180,76,.5);letter-spacing:.09em;line-height:2}
    .scarcity-text strong{color:var(--accent);display:block;margin-bottom:.2rem}
    .scar-bar-wrap{margin-top:.6rem;height:2px;background:rgba(255,255,255,.04)}
    .scar-bar{height:100%;width:28%;background:linear-gradient(90deg,var(--accent3),var(--accent));animation:scarpulse 2.5s ease-in-out infinite alternate}
    @keyframes scarpulse{from{opacity:.5}to{opacity:1}}

    /* ══════════════════════════════
       3. PORTFOLIO — cinematic media
    ══════════════════════════════ */
    .portfolio-section{margin-bottom:4rem}

    /* Hero portrait — uncropped, full display */
    .port-hero-img{
      width:100%;
      max-height:520px;
      object-fit:contain;
      object-position:center;
      border-radius:var(--radius);
      border:1px solid rgba(240,180,76,.12);
      background:#000;
      margin-bottom:1rem;
      display:block;
    }

    /* Cinematic video — autoplay muted loop, no controls */
    .port-video-wrap{
      width:100%;
      border-radius:var(--radius);
      overflow:hidden;
      border:1px solid rgba(240,180,76,.12);
      background:#000;
      margin-bottom:1rem;
      position:relative;
    }
    .port-video{
      width:100%;
      display:block;
      max-height:480px;
      object-fit:contain;
      background:#000;
      /* No controls, no poster thumbnail */
    }

    /* Two photos row */
    .port-photos{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
    .port-photo{
      width:100%;
      aspect-ratio:unset;
      max-height:340px;
      object-fit:contain;
      object-position:center;
      border-radius:var(--radius);
      border:1px solid rgba(255,255,255,.07);
      background:#000;
      display:block;
      transition:border-color .2s;
    }
    .port-photo:hover{border-color:rgba(240,180,76,.3)}

    /* Client trust logos under portfolio */
    .trust-strip{display:flex;align-items:center;justify-content:center;gap:2rem;flex-wrap:wrap;margin-top:2rem;padding:1.2rem;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);border-radius:var(--radius)}
    .trust-strip-label{font-family:'Press Start 2P',monospace;font-size:.26rem;color:rgba(255,255,255,.2);letter-spacing:.14em;width:100%;text-align:center;margin-bottom:.6rem}
    .trust-logo-wrap{display:flex;flex-direction:column;align-items:center;gap:.5rem}
    .trust-logo{
      max-height:1.8rem;
      max-width:120px;
      width:auto;
      object-fit:contain;
      filter:brightness(0) invert(1);
      opacity:.55;
      display:block;
    }
    .trust-logo.has-color{filter:none;opacity:.8}
    .trust-logo-name{font-family:'Press Start 2P',monospace;font-size:.22rem;color:rgba(255,255,255,.2);letter-spacing:.1em}

    /* ══════════════════════════════
       4. PACKAGES
    ══════════════════════════════ */
    .packages-section{margin-bottom:4rem}
    .packages-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1.1rem;margin-top:1.5rem}

    .pkg-card{
      background:var(--surface);
      border:2px solid rgba(240,180,76,.1);
      padding:1.8rem 1.5rem;
      position:relative;
      cursor:none;
      transition:border-color .2s,background .2s;
      border-radius:var(--radius);
      display:flex;flex-direction:column;
    }
    .pkg-card::before{content:'';position:absolute;top:-2px;left:-2px;width:14px;height:14px;border-top:2px solid var(--accent);border-left:2px solid var(--accent);border-radius:2px 0 0 0}
    .pkg-card::after{content:'';position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-bottom:2px solid var(--accent3);border-right:2px solid var(--accent3);border-radius:0 0 2px 0}
    .pkg-card.selected{border-color:var(--accent);background:rgba(240,180,76,.06)}
    .pkg-card.popular{border-color:rgba(240,180,76,.25)}

    .pkg-badge{font-family:'Press Start 2P',monospace;font-size:.26rem;color:var(--accent2);letter-spacing:.12em;margin-bottom:.9rem;display:block}
    .pkg-popular-tag{display:inline-block;font-family:'Press Start 2P',monospace;font-size:.24rem;background:rgba(240,180,76,.15);color:var(--accent);padding:.25rem .5rem;letter-spacing:.08em;margin-bottom:.7rem}
    .pkg-name{font-family:'Press Start 2P',monospace;font-size:.6rem;color:#fff;line-height:1.8;margin-bottom:1.1rem}

    .pkg-price-row{margin-bottom:1rem}
    .pkg-was{font-family:'Press Start 2P',monospace;font-size:.38rem;color:rgba(255,255,255,.2);text-decoration:line-through;display:block;margin-bottom:.3rem}
    .pkg-now-wrap{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
    .pkg-now{font-family:'Press Start 2P',monospace;font-size:.95rem;color:var(--accent);text-shadow:2px 2px 0 rgba(240,120,30,.25)}
    .pkg-off-tag{font-family:'Press Start 2P',monospace;font-size:.26rem;background:var(--accent2);color:#fff;padding:.2rem .4rem;letter-spacing:.06em}

    .pkg-divider{height:1px;background:rgba(255,255,255,.06);margin:1rem 0}

    .pkg-features{list-style:none;display:flex;flex-direction:column;gap:.55rem;margin-bottom:1.4rem;flex:1}
    .pkg-features li{font-family:'Space Mono',monospace;font-size:.74rem;color:var(--muted);line-height:1.7;display:flex;gap:.5rem;align-items:flex-start}
    .pkg-features li::before{content:'◈';color:var(--accent3);font-size:.55rem;flex-shrink:0;margin-top:.1rem}
    .pkg-features li.highlight{color:var(--text)}
    .pkg-features li.highlight::before{color:var(--accent)}

    .pkg-select-btn{
      width:100%;
      font-family:'Press Start 2P',monospace;
      font-size:.4rem;
      padding:.85rem;
      border:2px solid rgba(240,180,76,.25);
      background:transparent;
      color:var(--accent);
      cursor:none;
      letter-spacing:.07em;
      transition:background .15s,border-color .15s;
      margin-top:auto;
      min-height:48px;
    }
    .pkg-select-btn:hover{background:rgba(240,180,76,.07);border-color:var(--accent)}
    .pkg-card.selected .pkg-select-btn{background:var(--accent);color:#080810;border-color:var(--accent)}

    /* ══════════════════════════════
       5. CALENDAR
    ══════════════════════════════ */
    .calendar-section{margin-bottom:4rem}
    .cal-urgency{font-family:'Space Mono',monospace;font-size:.8rem;color:rgba(255,126,62,.7);margin-bottom:1.2rem;font-style:italic}
    .cal-urgency::before{content:'⚠ ';color:var(--accent2)}
    .cal-wrap{background:var(--surface);border:2px solid rgba(240,180,76,.1);padding:1.6rem;position:relative;border-radius:var(--radius)}
    .cal-wrap::before{content:'';position:absolute;top:-2px;left:-2px;width:14px;height:14px;border-top:2px solid var(--accent);border-left:2px solid var(--accent)}
    .cal-wrap::after{content:'';position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-bottom:2px solid var(--accent3);border-right:2px solid var(--accent3)}
    .cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.4rem}
    .cal-month{font-family:'Press Start 2P',monospace;font-size:.55rem;color:#fff;letter-spacing:.1em}
    .cal-btn{
      font-family:'Press Start 2P',monospace;font-size:.45rem;
      background:transparent;border:1px solid rgba(240,180,76,.2);
      color:var(--accent);padding:.5rem .9rem;
      cursor:none;transition:background .15s;
      min-width:48px;min-height:48px;
      display:inline-flex;align-items:center;justify-content:center;
    }
    .cal-btn:hover{background:rgba(240,180,76,.08)}
    .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
    .cal-dow{font-family:'Press Start 2P',monospace;font-size:.27rem;color:rgba(255,255,255,.22);text-align:center;padding:.5rem 0;letter-spacing:.05em}
    .cal-day{
      font-family:'Press Start 2P',monospace;font-size:.38rem;
      text-align:center;padding:.6rem .2rem;
      border:1px solid transparent;
      cursor:none;transition:background .15s,border-color .15s;
      line-height:1;min-height:48px;
      display:flex;align-items:center;justify-content:center;
    }
    .cal-day.empty{background:transparent}
    .cal-day.disabled{color:rgba(255,255,255,.1)}
    .cal-day.available{color:var(--text);border-color:rgba(240,180,76,.18);background:rgba(240,180,76,.04)}
    .cal-day.available:hover{background:rgba(240,180,76,.13);border-color:rgba(240,180,76,.45)}
    .cal-day.selected-day{background:var(--accent);color:#080810;border-color:var(--accent)}
    .cal-day.today{border-color:rgba(76,240,208,.35)}
    .cal-selected-display{margin-top:1.1rem;font-family:'Press Start 2P',monospace;font-size:.32rem;color:var(--accent3);letter-spacing:.1em;min-height:1.2rem}
    .cal-selected-display::before{content:'◈ ';color:var(--accent)}

    /* ══════════════════════════════
       6. FORM
    ══════════════════════════════ */
    .form-section{margin-bottom:2rem}
    .form-context{font-family:'Space Mono',monospace;font-size:.82rem;color:rgba(76,240,208,.65);margin-bottom:1.6rem;line-height:2;font-style:italic}
    .form-context::before{content:'◈ ';color:var(--accent3)}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.1rem;margin-top:1.5rem}
    @media(max-width:540px){.form-grid{grid-template-columns:1fr}}
    .field-wrap{display:flex;flex-direction:column;gap:.55rem}
    .field-wrap.full{grid-column:1/-1}
    .field-label{font-family:'Press Start 2P',monospace;font-size:.3rem;color:rgba(255,255,255,.3);letter-spacing:.14em}
    .field-input{
      font-family:'Space Mono',monospace;font-size:.88rem;color:#fff;
      background:rgba(255,255,255,.04);border:2px solid rgba(240,180,76,.18);
      padding:1rem 1rem;outline:none;cursor:none;caret-color:var(--accent);
      transition:border-color .2s,box-shadow .2s;
      -webkit-appearance:none;width:100%;min-height:54px;
      border-radius:3px;
    }
    .field-input::placeholder{color:rgba(255,255,255,.16)}
    .field-input:focus{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 0 16px rgba(240,180,76,.08)}
    .field-input.invalid{border-color:var(--accent2);box-shadow:0 0 0 1px var(--accent2)}

    .submit-wrap{margin-top:2rem;text-align:center}
    .btn-submit{
      width:100%;max-width:520px;
      font-family:'Press Start 2P',monospace;font-size:.6rem;
      color:#080810;background:var(--accent);border:none;cursor:none;
      padding:1.4rem 1rem;letter-spacing:.07em;position:relative;
      box-shadow:4px 4px 0 #7a5a20,7px 7px 0 rgba(0,0,0,.3);
      transition:box-shadow .1s steps(1),transform .1s steps(1);
      min-height:58px;
    }
    .btn-submit::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.16) 0%,transparent 55%);pointer-events:none}
    .btn-submit:hover:not(:disabled){box-shadow:2px 2px 0 #7a5a20,4px 4px 0 rgba(0,0,0,.3);transform:translate(2px,2px)}
    .btn-submit:active:not(:disabled){box-shadow:0 0 0 #7a5a20;transform:translate(4px,4px)}
    .btn-submit:disabled{opacity:.55;cursor:not-allowed}
    .submit-notes{margin-top:.8rem;display:flex;flex-direction:column;gap:.3rem;align-items:center}
    .submit-note-sm{font-family:'Press Start 2P',monospace;font-size:.26rem;color:rgba(255,255,255,.18);letter-spacing:.08em}
    .submit-note-sm.green{color:rgba(76,240,208,.35)}
    .submit-note-sm::before{content:'// '}
    .form-status{font-family:'Press Start 2P',monospace;font-size:.34rem;letter-spacing:.1em;margin-top:1.1rem;min-height:1rem;text-align:center;line-height:2.2}
    .form-status.success{color:var(--accent3)}
    .form-status.success::before{content:'✓ '}
    .form-status.error{color:var(--accent2)}
    .form-status.error::before{content:'✕ '}

    /* ── FOOTER ── */
    .lp-footer{text-align:center;padding:2.5rem 1rem;border-top:1px solid rgba(255,255,255,.04);font-family:'Press Start 2P',monospace;font-size:.28rem;color:rgba(255,255,255,.1);letter-spacing:.07em;line-height:2.5;position:relative;z-index:1}
    .lp-footer a{color:rgba(240,180,76,.25);text-decoration:none}
    .lp-footer a:hover{color:var(--accent)}

    /* ── ANIMATIONS ── */
    @keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
    .reveal{opacity:0;transform:translateY(16px);transition:opacity .5s steps(8),transform .5s steps(8)}
    .reveal.visible{opacity:1;transform:translateY(0)}

    /* ── MOBILE ── */
    @media(max-width:600px){
      .cursor,.cursor-outer{display:none}
      html,body{cursor:auto}
      .packages-grid{grid-template-columns:1fr}
      .cd-num{font-size:1.2rem}
      .price-card{padding:1.5rem 1.2rem;width:100%}
      .price-now{font-size:1.6rem}
      .price-was{font-size:.85rem}
      .port-photos{grid-template-columns:1fr}
      .port-photo{max-height:260px}
      .trust-strip{gap:1.2rem}
    }
    @media(prefers-reduced-motion:reduce){
      *,*::before,*::after{animation:none!important;transition:none!important}
      .cursor,.cursor-outer{display:none}
      html,body{cursor:auto}
      .glow{display:none}
    }
    :focus-visible{outline:2px solid var(--accent);outline-offset:3px}
    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  </style>
</head>
<body>

  <div class="cursor" id="cursorInner"><div class="cursor-inner"></div></div>
  <div class="cursor-outer" id="cursorOuter"></div>
  <div class="glow glow-1" aria-hidden="true"></div>
  <div class="glow glow-2" aria-hidden="true"></div>
  <div id="gate-spinner"><p>VERIFYING ACCESS...</p></div>

  <div id="content">

    <!-- LOGO -->
    <div class="logo-bar">
      <a href="index.html" class="logo-frame" aria-label="RAOUF px — main site">
        <img src="images/logo.png" alt="RAOUF px" width="36" height="36" loading="eager"/>
      </a>
    </div>

    <div class="page-wrap">

      <!-- ══ 1. HERO ══ -->
      <section class="hero reveal">
        <div class="hero-status">
          <span class="ping-dot" aria-hidden="true"></span>
          ACCESS_GRANTED &nbsp;·&nbsp; PRIVATE_OFFER
        </div>
        <h1 class="hero-h1">You unlocked a private<br>portrait session.</h1>
        <p class="hero-sub">A few sessions each month are reserved<br>for new clients discovering my work.</p>

        <div class="price-card" aria-label="Offer pricing">
          <span class="price-card-label">PRIVATE PORTRAIT SESSION</span>
          <div class="price-cols">
            <div class="price-col">
              <span class="price-col-lbl">STANDARD RATE</span>
              <span class="price-was">1,200 AED</span>
            </div>
            <span class="price-arrow">→</span>
            <div class="price-col">
              <span class="price-col-lbl">YOUR UNLOCKED RATE</span>
              <span class="price-now">600 AED</span>
            </div>
          </div>
          <span class="price-badge">PRIVATE CLIENT RATE — 50% OFF</span>
          <span class="price-note">Limited — only a few sessions available this month</span>
        </div>
      </section>

      <!-- ══ 2. COUNTDOWN ══ -->
      <div class="countdown-block reveal" aria-label="Offer expiry countdown">
        <span class="cd-label">THIS_OFFER_EXPIRES_IN</span>
        <div class="cd-digits" id="cdDigits">
          <div class="cd-unit"><span class="cd-num" id="cd-h">48</span><span class="cd-lbl">HRS</span></div>
          <span class="cd-sep" aria-hidden="true">:</span>
          <div class="cd-unit"><span class="cd-num" id="cd-m">00</span><span class="cd-lbl">MIN</span></div>
          <span class="cd-sep" aria-hidden="true">:</span>
          <div class="cd-unit"><span class="cd-num" id="cd-s">00</span><span class="cd-lbl">SEC</span></div>
        </div>
        <p class="cd-expired" id="cdExpired">OFFER EXPIRED</p>
        <div class="scarcity">
          <div class="scarcity-text">
            <strong>SESSIONS FILLING FAST</strong>
            Only a few discounted spots available each week.
          </div>
          <div class="scar-bar-wrap"><div class="scar-bar"></div></div>
        </div>
      </div>

      <!-- ══ 3. PORTFOLIO ══ -->
      <section class="portfolio-section reveal" aria-label="Portfolio">
        <span class="section-label">RECENT_WORK</span>

        <!-- Hero portrait — object-fit:contain, never cropped -->
        <img
          src="images/fulls/01.jpg"
          alt="Portrait by RAOUF px"
          class="port-hero-img"
          loading="lazy"
        />

        <!-- Cinematic video — autoplay muted loop, no controls, no poster -->
        <div class="port-video-wrap">
          <video
            class="port-video"
            autoplay
            muted
            loop
            playsinline
            preload="auto"
            aria-label="Cinematic portrait reel by RAOUF px"
          >
            <source src="videos/story.mp4"  type="video/mp4"/>
            <source src="videos/story.mov"  type="video/quicktime"/>
          </video>
        </div>

        <!-- Two photos — object-fit:contain, never cropped -->
        <div class="port-photos">
          <img src="images/fulls/09.jpg" alt="Portrait by RAOUF px" class="port-photo" loading="lazy"/>
          <img src="images/fulls/13.jpg" alt="Portrait by RAOUF px" class="port-photo" loading="lazy"/>
        </div>

        <!-- Trust strip — clients -->
        <div class="trust-strip" aria-label="Trusted by">
          <span class="trust-strip-label">TRUSTED BY</span>
          <div class="trust-logo-wrap">
            <img
              src="images/justlife-logo.png"
              alt="JustLife"
              class="trust-logo has-color"
              onerror="this.parentElement.style.display='none'"
            />
            <span class="trust-logo-name">JUSTLIFE</span>
          </div>
          <div class="trust-logo-wrap">
            <img
              src="images/arabian-star-logo.png"
              alt="Arabian Star Stables"
              class="trust-logo"
              onerror="this.style.display='none'"
            />
            <span class="trust-logo-name">ARABIAN STAR STABLES</span>
          </div>
        </div>
      </section>

      <!-- ══ 4. PACKAGES ══ -->
      <section class="packages-section reveal" aria-label="Choose your package">
        <span class="section-label">CHOOSE_YOUR_PACKAGE</span>
        <div class="packages-grid" id="packagesGrid">

          <!-- STARTER -->
          <div class="pkg-card" data-pkg="Starter" data-price="AED 125" tabindex="0" role="button" aria-pressed="false">
            <span class="pkg-badge">PACKAGE_01</span>
            <div class="pkg-name">STARTER</div>
            <div class="pkg-price-row">
              <span class="pkg-was">AED 250</span>
              <div class="pkg-now-wrap">
                <span class="pkg-now">AED 125</span>
                <span class="pkg-off-tag">50% OFF</span>
              </div>
            </div>
            <div class="pkg-divider"></div>
            <ul class="pkg-features">
              <li>30-minute session</li>
              <li>10 edited photos</li>
              <li>1 shooting location</li>
              <li>3-day delivery</li>
            </ul>
            <button class="pkg-select-btn" type="button">[ SELECT ]</button>
          </div>

          <!-- SIGNATURE (popular) -->
          <div class="pkg-card popular" data-pkg="Signature" data-price="AED 249" tabindex="0" role="button" aria-pressed="false">
            <span class="pkg-badge">PACKAGE_02</span>
            <span class="pkg-popular-tag">★ MOST POPULAR</span>
            <div class="pkg-name">SIGNATURE</div>
            <div class="pkg-price-row">
              <span class="pkg-was">AED 499</span>
              <div class="pkg-now-wrap">
                <span class="pkg-now">AED 249</span>
                <span class="pkg-off-tag">50% OFF</span>
              </div>
            </div>
            <div class="pkg-divider"></div>
            <ul class="pkg-features">
              <li>1-hour session</li>
              <li>25 edited photos</li>
              <li>2 shooting locations</li>
              <li>Outfit change included</li>
            </ul>
            <button class="pkg-select-btn" type="button">[ SELECT ]</button>
          </div>

          <!-- STORYTELLING -->
          <div class="pkg-card" data-pkg="Storytelling" data-price="AED 499" tabindex="0" role="button" aria-pressed="false">
            <span class="pkg-badge">PACKAGE_03</span>
            <div class="pkg-name">STORYTELLING</div>
            <div class="pkg-price-row">
              <span class="pkg-was">AED 999</span>
              <div class="pkg-now-wrap">
                <span class="pkg-now">AED 499</span>
                <span class="pkg-off-tag">50% OFF</span>
              </div>
            </div>
            <div class="pkg-divider"></div>
            <ul class="pkg-features">
              <li>2-hour session</li>
              <li>50+ edited photos</li>
              <li>3 shooting locations</li>
              <li>Multiple outfit changes</li>
              <li class="highlight">◆ CINEMATIC REEL INCLUDED</li>
              <li class="highlight">Short film of the session</li>
            </ul>
            <button class="pkg-select-btn" type="button">[ SELECT ]</button>
          </div>

        </div>
      </section>

      <!-- ══ 5. CALENDAR ══ -->
      <section class="calendar-section reveal" aria-label="Pick your session date">
        <span class="section-label">CHOOSE_YOUR_DATE</span>
        <p class="cal-urgency">Weekend sessions usually book out quickly.</p>
        <div class="cal-wrap">
          <div class="cal-nav">
            <button class="cal-btn" id="calPrev" aria-label="Previous month">◀</button>
            <span class="cal-month" id="calMonth"></span>
            <button class="cal-btn" id="calNext" aria-label="Next month">▶</button>
          </div>
          <div class="cal-grid" id="calGrid" role="grid" aria-label="Session date picker"></div>
          <div class="cal-selected-display" id="calSelectedDisplay" aria-live="polite"></div>
        </div>
      </section>

      <!-- ══ 6. BOOKING FORM ══ -->
      <section class="form-section reveal" aria-label="Book your session">
        <span class="section-label">YOUR_DETAILS</span>
        <p class="form-context">After submitting, I'll contact you on WhatsApp to confirm your session.</p>

        <form id="bookingForm" novalidate>
          <!-- Hidden fields — do not remove -->
          <input type="hidden" name="_subject"  value="Private Portrait Session — Street Promo"/>
          <input type="hidden" name="package"   id="fieldPackage" value=""/>
          <input type="hidden" name="price"     id="fieldPrice"   value=""/>
          <input type="hidden" name="date"      id="fieldDate"    value=""/>
          <input type="hidden" name="promo"     value="STREET50"/>

          <div class="form-grid">
            <div class="field-wrap">
              <label class="field-label" for="fieldName">NAME</label>
              <input class="field-input" type="text"  id="fieldName"  name="name"     placeholder="Your full name"    autocomplete="name"  required/>
            </div>
            <div class="field-wrap">
              <label class="field-label" for="fieldEmail">EMAIL</label>
              <input class="field-input" type="email" id="fieldEmail" name="email"    placeholder="your@email.com"   autocomplete="email" required/>
            </div>
            <div class="field-wrap full">
              <label class="field-label" for="fieldWa">WHATSAPP NUMBER</label>
              <input class="field-input" type="tel"   id="fieldWa"    name="whatsapp" placeholder="+971 50 000 0000" autocomplete="tel"   required/>
            </div>
          </div>

          <div class="submit-wrap">
            <button class="btn-submit" type="submit" id="submitBtn">[ LOCK IN MY SESSION ]</button>
            <div class="submit-notes">
              <span class="submit-note-sm">Takes less than 20 seconds.</span>
              <span class="submit-note-sm green">No payment now — Osama confirms via WhatsApp.</span>
            </div>
            <p class="form-status" id="formStatus"></p>
          </div>
        </form>
      </section>

    </div><!-- /.page-wrap -->

    <footer class="lp-footer">
      &copy; 2025 RAOUF px &nbsp;·&nbsp; Dubai, UAE &nbsp;·&nbsp;
      <a href="mailto:Contact@raoufpx.com">Contact@raoufpx.com</a>
      &nbsp;·&nbsp;
      <a href="index.html">Main site</a>
    </footer>

  </div><!-- /#content -->

  <script>
  (() => {
    'use strict';

    const API_BASE  = 'https://raoufpx-promo-server-production.up.railway.app';
    const FORMSPREE = 'https://formspree.io/f/xnnvndyv';
    const TIMER_KEY = 'raoufpx_promo_deadline';
    const TTL_MS    = 48 * 60 * 60 * 1000;

    /* ── Cursor ── */
    const ci = document.getElementById('cursorInner');
    const co = document.getElementById('cursorOuter');
    if (window.matchMedia('(pointer:fine)').matches) {
      document.addEventListener('mousemove', e => {
        ci.style.left = e.clientX+'px'; ci.style.top = e.clientY+'px';
        co.style.left = e.clientX+'px'; co.style.top = e.clientY+'px';
      });
    } else {
      ci.style.display = co.style.display = 'none';
      document.body.style.cursor = 'auto';
    }

    /* ── Gate guard ── */
    const spinner = document.getElementById('gate-spinner');
    const content = document.getElementById('content');

    async function verifyAccess() {
      const ssGranted = sessionStorage.getItem('raoufpx_granted');
      const ssToken   = sessionStorage.getItem('raoufpx_promo');
      const ssExpiry  = parseInt(sessionStorage.getItem('raoufpx_expires')||'0',10)||null;

      if (ssGranted === '1' || ssToken) {
        reveal(ssExpiry);
        try {
          const r = await fetch(API_BASE+'/verify-token',{credentials:'include',signal:AbortSignal.timeout(4000)});
          const d = await r.json();
          if (d.expiresAt) initCountdown(d.expiresAt);
        } catch(e) { /* silent fallback */ }
        return;
      }

      try {
        const r = await fetch(API_BASE+'/verify-token',{credentials:'include',signal:AbortSignal.timeout(6000)});
        const d = await r.json();
        if (d.valid) { reveal(d.expiresAt||null); }
        else { window.location.replace('secret.html'); }
      } catch(e) {
        window.location.replace('secret.html');
      }
    }

    function reveal(expiresAt) {
      spinner.classList.add('hidden');
      content.classList.add('unlocked');
      const ro = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); }
      }), {threshold:0.06});
      document.querySelectorAll('.reveal').forEach(el => ro.observe(el));
      initCountdown(expiresAt);
    }

    verifyAccess();

    /* ── Countdown ── */
    function initCountdown(serverExpiry) {
      let deadline = parseInt(localStorage.getItem(TIMER_KEY)||'0',10);
      if (!deadline || deadline < Date.now()) {
        deadline = serverExpiry || (Date.now() + TTL_MS);
        localStorage.setItem(TIMER_KEY, String(deadline));
      }
      const cdH=document.getElementById('cd-h');
      const cdM=document.getElementById('cd-m');
      const cdS=document.getElementById('cd-s');
      const cdDigits=document.getElementById('cdDigits');
      const cdExpired=document.getElementById('cdExpired');
      const pad = n => String(n).padStart(2,'0');
      function tick() {
        const rem = deadline - Date.now();
        if (rem <= 0) { cdDigits.style.display='none'; cdExpired.style.display='block'; clearInterval(t); return; }
        const s = Math.floor(rem/1000);
        cdH.textContent=pad(Math.floor(s/3600));
        cdM.textContent=pad(Math.floor((s%3600)/60));
        cdS.textContent=pad(s%60);
      }
      tick();
      const t = setInterval(tick,1000);
    }

    /* ── Package selection ── */
    const cards = document.querySelectorAll('.pkg-card');
    cards.forEach(card => {
      const select = () => {
        cards.forEach(c=>{c.classList.remove('selected');c.setAttribute('aria-pressed','false');});
        card.classList.add('selected');
        card.setAttribute('aria-pressed','true');
        document.getElementById('fieldPackage').value = card.dataset.pkg;
        document.getElementById('fieldPrice').value   = card.dataset.price;
      };
      card.addEventListener('click', select);
      card.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();select();} });
    });

    /* ── Calendar ── */
    const MONTHS=['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    const DAYS=['SUN','MON','TUE','WED','THU','FRI','SAT'];
    let calYear, calMonth, selectedDate=null;

    function initCal() {
      const now=new Date(); calYear=now.getFullYear(); calMonth=now.getMonth(); renderCal();
    }
    function renderCal() {
      document.getElementById('calMonth').textContent = MONTHS[calMonth]+' '+calYear;
      const grid=document.getElementById('calGrid');
      const today=new Date(); today.setHours(0,0,0,0);
      grid.innerHTML='';
      DAYS.forEach(d=>{
        const el=document.createElement('div');
        el.className='cal-dow'; el.textContent=d; grid.appendChild(el);
      });
      const firstDay=new Date(calYear,calMonth,1).getDay();
      const dim=new Date(calYear,calMonth+1,0).getDate();
      for(let i=0;i<firstDay;i++){
        const el=document.createElement('div'); el.className='cal-day empty'; grid.appendChild(el);
      }
      for(let d=1;d<=dim;d++) {
        const date=new Date(calYear,calMonth,d); date.setHours(0,0,0,0);
        const dow=date.getDay();
        /* UAE weekend = Friday(5) + Saturday(6) */
        const avail=(dow===5||dow===6)&&date>=today;
        const el=document.createElement('div');
        el.className='cal-day '+(avail?'available':'disabled');
        el.textContent=d;
        if(date.getTime()===today.getTime()) el.classList.add('today');
        if(selectedDate&&date.getTime()===selectedDate.getTime()) el.classList.add('selected-day');
        if(avail) {
          el.setAttribute('role','button'); el.setAttribute('tabindex','0');
          const ds=date.toLocaleDateString('en-AE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
          const pick=()=>{
            document.querySelectorAll('.cal-day.selected-day').forEach(x=>x.classList.remove('selected-day'));
            el.classList.add('selected-day'); selectedDate=date;
            document.getElementById('fieldDate').value=ds;
            document.getElementById('calSelectedDisplay').textContent=ds;
          };
          el.addEventListener('click',pick);
          el.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();} });
        }
        grid.appendChild(el);
      }
    }
    document.getElementById('calPrev').addEventListener('click',()=>{ if(--calMonth<0){calMonth=11;calYear--;} renderCal(); });
    document.getElementById('calNext').addEventListener('click',()=>{ if(++calMonth>11){calMonth=0;calYear++;} renderCal(); });
    initCal();

    /* ── Form submission ── */
    const form       = document.getElementById('bookingForm');
    const submitBtn  = document.getElementById('submitBtn');
    const formStatus = document.getElementById('formStatus');
    const showStatus = (type,msg)=>{ formStatus.className='form-status '+type; formStatus.textContent=msg; };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      formStatus.className='form-status'; formStatus.textContent='';

      if(!document.getElementById('fieldPackage').value) {
        showStatus('error','Please select a package above.');
        document.getElementById('packagesGrid').scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }
      if(!document.getElementById('fieldDate').value) {
        showStatus('error','Please select a session date.');
        document.querySelector('.calendar-section').scrollIntoView({behavior:'smooth',block:'center'});
        return;
      }

      const name  = document.getElementById('fieldName');
      const email = document.getElementById('fieldEmail');
      const wa    = document.getElementById('fieldWa');
      let ok=true;
      [name,email,wa].forEach(f=>{ f.classList.remove('invalid'); if(!f.value.trim()){f.classList.add('invalid');ok=false;} });
      if(email.value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)){email.classList.add('invalid');ok=false;}
      if(!ok){showStatus('error','Please fill in all fields correctly.');return;}

      submitBtn.disabled=true; submitBtn.textContent='[ SENDING... ]';
      try {
        const r=await fetch(FORMSPREE,{
          method:'POST',
          headers:{'Accept':'application/json','Content-Type':'application/json'},
          body:JSON.stringify({
            name:name.value.trim(), email:email.value.trim(), whatsapp:wa.value.trim(),
            package:document.getElementById('fieldPackage').value,
            price:document.getElementById('fieldPrice').value,
            date:document.getElementById('fieldDate').value,
            promo:'STREET50', _subject:'Street Promo Booking 50% Off'
          })
        });
        if(r.ok) {
          submitBtn.textContent='[ BOOKING CONFIRMED ]';
          submitBtn.style.background='var(--accent3)';
          showStatus('success','Booking received! Osama will confirm via WhatsApp shortly.');
          form.querySelectorAll('.field-input').forEach(f=>f.disabled=true);
          localStorage.removeItem(TIMER_KEY);
          sessionStorage.removeItem('raoufpx_promo');
          sessionStorage.removeItem('raoufpx_granted');
        } else { throw new Error(); }
      } catch(err) {
        submitBtn.disabled=false;
        submitBtn.textContent='[ LOCK IN MY SESSION ]';
        showStatus('error','Submission failed. Please try again or WhatsApp directly.');
      }
    });

  })();
  </script>

</body>
</html>
