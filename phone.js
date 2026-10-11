// PHONE: a small retro phone in the corner that occasionally rings. Answering plays an HM-style answering-machine message
// from a random archive character. Real in-game lines come from data.json quotes; everything else is clearly marked fan-written.
(() => {
  const FAN = {
    'jacket': ["...", "(heavy breathing on the line. Then a click.)"],
    'biker': ["Who's calling you? Who is it? Tell me who's making these calls or I swear I'll find out myself.", "Third message this week. Same voice. Same address. I'm done taking orders from a phone."],
    'beard': ["Hey, it's me from the store on the corner. Got a fresh batch in, on the house. Swing by after work, huh? Kid, you look tired.", "Wanted to say thanks for the other night. Don't worry about the tab. You'd do the same for me."],
    'the-son': ["The family business is booming tonight. Bring a friend. Bring two. The party's at the top floor.", "My father thinks he runs this city. He's wrong. Call me back."],
    'tony': ["Hi, this is Tony from the Vulture Gym. Your membership's overdue. Come down and work it off. Wear something you don't mind getting dirty.", "It's Tony. Party stinks. Pick me up."],
    'mark': ["Hey, it's Mark. We're getting pizza after. You in? Bring the guns. I mean... the guys.", "This is Mark from the Two-Barrel Range. Your order's ready. Two of everything."],
    'corey': ["Hi, it's Corey from the roller rink. Lost and found has your mask. You know the one. Come by before close.", "Corey here. Don't wait up. Don't bring the mask this time... okay, bring the mask."],
    'alex-davis': ["Alex and Ash here, from Twin Saws Hardware. Big sale on everything with a motor. Come early, it gets messy.", "We're bored. Get over here."],
    'ash-davis': ["Ash again. Alex says hi. Alex says a lot of things. Bring the van around back.", "This is Ash from the karaoke bar. Room 3 is booked under your name. Don't sing, just show up."],
    'evan-wright': ["Hi, this is Evan. I'm writing about the calls. I think you got one too. I'm not judging. I just want to know who's dialing.", "Evan again. My editor wants a chapter by Friday. My wife wants me home by eight. Neither is going to happen."],
    'manny-pardo': ["Detective Pardo, Miami PD. I'd like to ask you a few questions about the Fifty Blessings. No rush. Actually, rush.", "This is Pardo. Another body near the docks. I'll take the case. I always take the case."],
    'jake': ["This is Jake from the Fifty Blessings newsletter. America needs you. Package at the usual spot. Show some respect for the flag.", "Jake here. They said this was for the country. They didn't say which one."],
    'richter': ["Hi... it's Richter. I've been getting these letters too. I don't want to do this. Rent's due. You understand.", "It's me. Mom's doing better. I'm doing what they ask. Don't call back."],
    'martin-brown': ["Martin Brown, method actor. The pig mask fits. The blood is corn syrup. Mostly.", "This is Martin. Rehearsal's tonight. Off book. Fully committed."],
    'the-henchman': ["Hey, it's the guy from the warehouse. One last job, then I'm out. Then it's the beach. Promise.", "I just wanted to say I'm going home after this. That's all. Bye."],
    'h-m-hammarin': ["Hammarin here. Hand over the tapes. Every one of them. Nobody gets hurt if nobody gets curious.", "This is the Hammarin residence. Nobody's home. Leave the package by the door."],
    'richard': ["You've reached Richard. I'm not here. I'm never really here. Think about where you are.", "Do you know who you're listening to? ...Neither do I. Hang up when you're ready."],
    'rasmus': ["Hello again. Same question as last time. We both know the answer.", "Do you remember the address on the message? You will."],
    'don-juan': ["Hey there. Don't worry about it. Wherever you're going, you'll get there.", "You don't know who you are yet. That's alright. I'll wait."],
    'girlfriend': ["Hey... it's me. The door was open, I hope that's okay. Come home soon?", "I made dinner. Again. It's cold now. Just... call me."],
    'the-janitors': ["Hi, this is Jim and Bill from the cleaning crew. We'll be by in the morning. Leave the floors as they are.", "Janitorial service. Your building has a stain we can't get out. We'll keep trying."],
    'the-father': ["You've been very busy in my city. My son says you have talent. Come up to the penthouse. Let's discuss your future.", "This message is for the man in the animal mask. You work for me now. Or you don't work at all."],
    'the-grandfather': ["This is an old man calling. I've seen this before. It ends the same way every time.", "Whatever you came here for, I hope it was worth the trip."],
    'daniels': ["Daniels here. We need your help on a job up north. Bring your own gear. Don't bring questions.", "This is Daniels. They're cutting the program. Pack light."],
    'the-colonel': ["Colonel speaking. Your squad's waiting at the LZ. Do try to keep them alive this time, son.", "Mission briefing at 0600. Don't be late. Don't be early, either."],
    'aleksei': ["Hi, this is Aleksei from the Hawaiian Breeze tanning salon. We're throwing a little party in the back. Wear the mask.", "Your appointment's tonight. Take off the mask when you get here. Or don't."],
    'pizza-dude': ["Hi, it's Pizza Pete. Your order's been sitting here an hour. Large, extra everything. Address is on the box.", "This is the pizza place. We don't deliver to that building anymore. You know why."],
    'van-driver': ["Hi, this is the guy with the van. Pick-up at the back door, 11pm. Don't ask what's in the boxes.", "Van's out front. Engine's running. Don't make me wait."],
    'phantom': ["...Hello? Hello? Did you like the show?", "Bravo. Encore. Now take a bow."],
    'the-producer': ["Studio calling. The director wants another take. More blood, less hesitation. We roll at midnight.", "We're behind schedule. Find another 'actor'. Anyone will do."],
    'gang-leader': ["You're on our block now. The crew wants a word. Come alone.", "Somebody's been wearing our colors. Tell them to stop. Or don't, and see what happens."],
    'technician': ["Building maintenance. The lights on floor two keep flickering. Don't go up there tonight.", "Hi, technician here. Your phone line has a bug. Not that kind. Okay, maybe that kind."],
    'tattoo-artist': ["Hey, it's the parlor. Your design's ready. Fifty little doves. Come sit for it.", "Ink's still wet. Don't go swimming. Don't go anywhere, actually."],
    'manager': ["Hi, this is the night manager at the convenience store. You left your jacket here. And a few other things.", "We're closed. Please stop calling. Please stop coming in through the back."],
    'kurt': ["Hey, it's Kurt. Need a hand with the move? I've got a truck. And a bat. Just in case.", "Kurt here. Don't tell anyone I called."],
  };
  let D = null, pool = [], timer = 0, ringing = false, busy = false, typeT = 0, last = null;
  const isOpen = () => (window.HM && HM.isOpen && HM.isOpen()) || !!document.querySelector('.ph-call:not([hidden])');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function build() {
    if (!D) return; pool = D.characters.filter(c => FAN[c.id] || c.quote).map(c => ({ c, fan: FAN[c.id] || [], real: c.quote || null }));
  }
  function mount() {
    const w = document.createElement('div'); w.className = 'ph-wrap';
    w.innerHTML = `<button class="ph-btn" type="button" aria-label="Phone: listen to a message"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11c0-4 6-6 12-6s12 2 12 6v2h-6v-3c-2-1-10-1-12 0v3H4z" fill="#ff2a8a"/><path d="M8 15h16l3 12H5z" fill="#14031f" stroke="#16f4ff" stroke-width="2"/><circle cx="16" cy="21" r="3.2" fill="none" stroke="#ffe14d" stroke-width="2"/></svg><span class="ph-dot"></span></button>`;
    document.body.appendChild(w);
    const ov = document.createElement('div'); ov.className = 'ph-call'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Answering machine message');
    ov.innerHTML = `<div class="ph-box"><div class="ph-top"><span class="ph-rec">● MSG</span><span class="ph-num"></span></div><div class="ph-who"><img class="ph-img" alt=""><div><div class="ph-from">MESSAGE FROM</div><div class="ph-name"></div><div class="ph-tag"></div></div></div><p class="ph-txt" aria-live="polite"></p><div class="ph-src"></div><div class="ph-act"><button type="button" class="ph-hang">HANG UP</button><button type="button" class="ph-next">ANSWER ANOTHER</button></div></div>`;
    document.body.appendChild(ov);
    w.querySelector('.ph-btn').onclick = () => answer();
    ov.querySelector('.ph-hang').onclick = hang; ov.querySelector('.ph-next').onclick = () => answer(true);
    ov.addEventListener('click', e => { if (e.target === ov) hang(); });
    addEventListener('keydown', e => { if (ov.hidden) return; if (e.key === 'Escape') { e.preventDefault(); hang(); } else if (e.key === 'Tab') { const b = [...ov.querySelectorAll('button')]; const i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus(); } }, true);
    const fit = () => { const dock = document.querySelector('.spiral-wrap'); const fixed = dock && getComputedStyle(dock).position === 'fixed'; document.documentElement.style.setProperty('--dockH', fixed ? dock.offsetHeight + 'px' : '0px'); }; fit(); addEventListener('resize', fit);
    schedule(45000 + Math.random() * 45000);
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(ring, ms); }
  function ring() {
    if (isOpen() || document.hidden) { schedule(60000); return; } // never ring over an open dossier or call
    ringing = true; const b = document.querySelector('.ph-wrap'); b.classList.add('ring');
    if (window.SFX) SFX.play('ring'); setTimeout(() => { if (ringing && window.SFX && !isOpen()) SFX.play('ring'); }, 1600);
    setTimeout(() => { ringing = false; b.classList.remove('ring'); b.classList.add('missed'); }, 3800);
    schedule((180 + Math.random() * 180) * 1000); // at most every 3-6 minutes
  }
  function answer(another) {
    if (!pool.length) build(); if (!pool.length) return;
    const ov = document.querySelector('.ph-call'), b = document.querySelector('.ph-wrap'); ringing = false; b.classList.remove('ring', 'missed');
    let p; do p = pool[(Math.random() * pool.length) | 0]; while (pool.length > 1 && p === last); last = p;
    const useReal = p.real && (!p.fan.length || Math.random() < 0.4), line = useReal ? p.real : p.fan[(Math.random() * p.fan.length) | 0];
    ov.querySelector('.ph-img').src = p.c.img; ov.querySelector('.ph-img').alt = p.c.name;
    const pm = p.c.name.match(/^(.*?)\s*\((.*)\)$/); ov.querySelector('.ph-name').textContent = (pm ? pm[1] : p.c.name).toUpperCase(); ov.querySelector('.ph-tag').textContent = pm ? pm[2] : (p.c.role || '').slice(0, 60);
    ov.querySelector('.ph-num').textContent = `${String(1 + ((Math.random() * 9) | 0))} NEW · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    ov.querySelector('.ph-src').textContent = useReal ? `in-game line${p.c.quoteGame ? ' · ' + p.c.quoteGame : ''} (via the Hotline Miami wiki)` : 'fan-written message, not from the game';
    const was = ov.hidden; ov.hidden = false; document.body.classList.add('ph-open'); if (was) { ov.dataset.ret = ''; ov._ret = document.activeElement; }
    if (window.SFX) SFX.play(another ? 'tab' : 'pickup');
    const el = ov.querySelector('.ph-txt'), full = '"' + line + '"'; let i = 0; clearInterval(typeT); el.textContent = ''; el.classList.add('typing');
    typeT = setInterval(() => { i++; el.textContent = full.slice(0, i); if (window.SFX && full[i - 1] !== ' ') SFX.play('type'); if (i >= full.length) { clearInterval(typeT); el.classList.remove('typing'); } }, 32);
    setTimeout(() => ov.querySelector('.ph-next').focus({ preventScroll: true }), 50);
  }
  function hang() {
    const ov = document.querySelector('.ph-call'); if (ov.hidden) return; clearInterval(typeT); ov.hidden = true; document.body.classList.remove('ph-open');
    if (window.SFX) SFX.play('hang'); const r = ov._ret || document.querySelector('.ph-btn'); r && r.focus && r.focus({ preventScroll: true });
  }
  window.PHONE = { ring, answer, hang, count: () => (build(), pool.length), fanCount: () => Object.keys(FAN).length };
  addEventListener('hmdata', () => { D = window.HM && HM.D; build(); });
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount();
})();
