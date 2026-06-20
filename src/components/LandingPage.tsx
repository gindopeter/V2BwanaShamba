import React, { useEffect, useRef, useState } from 'react';

// Where the marketing landing should hand off the visitor in the Login flow.
export type AuthTarget = 'signin' | 'register' | 'chat';

interface LandingPageProps {
  onEnter: (target: AuthTarget) => void;
}

type Lang = 'en' | 'sw';

const STRINGS = {
  en: {
    signIn: 'Sign In',
    heroBadge: 'AI Agronomist · built for Tanzanian farmers',
    heroLine1: 'Your whole farm,',
    heroSub: 'BwanaShamba turns your phone into an agronomist that knows your location, your crops and your weather — and works alongside you every single day of the season.',
    heroCta1: 'Sign Up Its Free',
    heroCta2: 'Chat with BwanaShamba',
    verbs: ['managed by AI.', 'planned each day.', 'tracked to harvest.', 'ready for the bank.'],
    introEyebrow: 'What it does',
    introTitle: 'Four ways BwanaShamba works for you',
    introSub: 'From a quick question at dawn to a season report for your bank — every feature is grounded in your real farm data.',
    c1Header: 'Chat with BwanaShamba',
    c1Online: 'online',
    c1User: 'Why are my tomato leaves curling upward?',
    c1Ai: 'With the heat in Arusha this week, upward curl on week-6 tomato is usually heat stress, not disease. Shade midday & check soil moisture before tonight’s rain.',
    c1Beyond: 'Want today’s market price for tomato too?',
    c1Title: 'Chat with an AI that knows your farm',
    c1P1: 'Ask anything and get curated advice grounded in your reality — your location, the crops you’ve planted and live weather for your area. No generic answers.',
    c1P2: 'And when you need it to, the AI reaches beyond your farm — market prices, pest outbreaks nearby, best-practice agronomy — to bring the bigger picture back to you.',
    c1Chip1: 'Location-aware',
    c1Chip2: 'Weather-aware',
    c1Chip3: 'Goes beyond your farm',
    c2Today: 'Today',
    c2Date: 'Tue, 20 June',
    c2Tasks: '3 tasks',
    c2T1: 'Irrigate Zone A before midday',
    c2T1Sub: 'High priority · heat + flowering stage',
    c2T2: 'Scout for aphids on tomato',
    c2T2Sub: 'Recommended after rain',
    c2T3: 'Apply fertilizer — Zone B',
    c2T3Sub: 'Reminder · you scheduled this',
    c2Title: 'Know exactly what matters today',
    c2P1: 'Every morning the app surfaces the most important tasks for that day, ranked by what your crops, stage and weather actually need right now.',
    c2P2: 'Already set a task yourself? The AI folds it into the day and reminds you — so nothing important slips through.',
    c2Chip1: 'Daily priorities',
    c2Chip2: 'Smart reminders',
    c3Crop: '🍅 Tomato · Zone A',
    c3Day: 'Day 42 / 95',
    c3M1: 'Germination',
    c3M1Sub: 'Complete',
    c3M2: 'Vegetative · now',
    c3Key: 'Key task · top-dress fertilizer in 3 days',
    c3M3: 'Flowering',
    c3M3Sub: 'In ~12 days',
    c3M4: 'Fruiting & Harvest',
    c3M4Sub: 'Plan ahead',
    c3Title: 'Follow every crop, milestone by milestone',
    c3P1: 'See each crop’s growth stages and the key tasks inside every milestone. Track progress at a glance and know what’s coming next.',
    c3P2: 'Plan ahead with confidence — so jobs like applying fertilizer happen exactly when the crop needs them, not a week too late.',
    c3Chip1: 'Stage tracking',
    c3Chip2: 'Plan ahead',
    c4Report: 'Season report',
    c4Season: 'Long rains 2026',
    c4Meta: 'Maganzo Farm · 4.2 ha',
    c4YieldLabel: 'Yield',
    c4YieldVal: '7.8 t',
    c4MarginLabel: 'Margin',
    c4Title: 'Reports your bank will take seriously',
    c4P1: 'From your farm data — plus anything you add — BwanaShamba builds clear reports of your farm and crop performance, exportable to PDF and Excel.',
    c4P2: 'Analyse performance season by season — and share credible records with a financial institution when you’re seeking a loan as a smallholder farmer.',
    c4Chip1: 'PDF & Excel export',
    c4Chip2: 'Loan-ready',
    ctaTitle: 'Start managing your farm with BwanaShamba today',
    ctaSub: 'Free to start. Register with your phone number or email and build your farm profile in minutes.',
    ctaBtn1: 'Create free account',
    ctaBtn2: 'Sign in',
    footerTagline: 'AI Agronomist, in your pocket',
  },
  sw: {
    signIn: 'Ingia',
    heroBadge: 'Mtaalam wa Kilimo wa AI · kwa wakulima wa Tanzania',
    heroLine1: 'Shamba lako lote,',
    heroSub: 'BwanaShamba inageuza simu yako kuwa mtaalam wa kilimo anayejua eneo lako, mazao yako na hali ya hewa — na anayefanya kazi pamoja nawe kila siku ya msimu.',
    heroCta1: 'Jisajili Ni Bure',
    heroCta2: 'Ongea na BwanaShamba',
    verbs: ['linasimamiwa na AI.', 'linapangwa kila siku.', 'linafuatiliwa hadi mavuno.', 'liko tayari kwa benki.'],
    introEyebrow: 'Uwezo wake',
    introTitle: 'Njia nne BwanaShamba inaweza kukusaidia na kuboresha kilimo chako.',
    introSub: 'Kuanzia kuuliza swali alfajiri na mapema hadi ripoti ya msimu inayoweza kukufaa benki - BwanaShamba inaangalia kila kipengele na taarifa halisi za shamba lako.',
    c1Header: 'Ongea na BwanaShamba',
    c1Online: 'mtandaoni',
    c1User: 'Kwa nini majani ya nyanya yangu yanajikunja kuelekea juu?',
    c1Ai: 'Kwa joto la Arusha wiki hii, kujikunja kwa juu kwa nyanya ya wiki ya 6 mara nyingi ni msongo wa joto, si ugonjwa. Weka kivuli mchana na angalia unyevu wa udongo kabla ya mvua ya usiku.',
    c1Beyond: 'Ungependa pia bei ya soko ya nyanya ya leo?',
    c1Title: 'Ongea na AI inayojua shamba lako',
    c1P1: 'Uliza chochote upate ushauri ulioandaliwa kulingana na taarifa halisi za shamba — eneo lako, mazao uliyopanda na hali ya hewa ya eneo lako. Hakuna majibu ya jumla.',
    c1P2: 'Na inapohitajika, BwanaShamba inaweza kukupa taarifa zaidi kama bei za sokoni, milipuko ya magonjwa na wadudu, kanuni bora za kilimo ili kukupa picha pana katika shughuli zako za kilimo.',
    c1Chip1: 'Inajua eneo',
    c1Chip2: 'Inajua hali ya hewa',
    c1Chip3: 'Inakwenda mbali zaidi',
    c2Today: 'Leo',
    c2Date: 'Jumanne, 20 Juni',
    c2Tasks: 'kazi 3',
    c2T1: 'Mwagilia Eneo A kabla ya mchana',
    c2T1Sub: 'Kipaumbele cha juu · joto + hatua ya maua',
    c2T2: 'Kagua wadudu (vidukari) kwenye nyanya',
    c2T2Sub: 'Inapendekezwa baada ya mvua',
    c2T3: 'Weka mbolea — Eneo B',
    c2T3Sub: 'Kikumbusho · ulipanga hili',
    c2Title: 'Fahamu kipi muhimu leo',
    c2P1: 'Kila asubuhi programu inaonyesha kazi muhimu zaidi za siku hiyo, zikipangwa kulingana na mahitaji halisi ya mazao kwa hatua yaliyofikia na hali ya hewa iliyopo.',
    c2P2: 'Tayari umeweka kazi yako mwenyewe? BwanaShamba itakukumbusha wakati wake utakapofikia na kuhakikisha hakuna kitu kinachosahaulika.',
    c2Chip1: 'Vipaumbele vya kila siku',
    c2Chip2: 'Vikumbusho mahiri',
    c3Crop: '🍅 Nyanya · Eneo A',
    c3Day: 'Siku 42 / 95',
    c3M1: 'Kuota',
    c3M1Sub: 'Imekamilika',
    c3M2: 'Ukuaji · sasa',
    c3Key: 'Kazi muhimu · weka mbolea ya juu baada ya siku 3',
    c3M3: 'Kutoa maua',
    c3M3Sub: 'Baada ya ~siku 12',
    c3M4: 'Kuzaa & Mavuno',
    c3M4Sub: 'Panga mapema',
    c3Title: 'Fuatilia kila zao, hatua kwa hatua',
    c3P1: 'Ona hatua za ukuaji za kila zao na kazi muhimu ndani ya kila hatua. Fuatilia maendeleo kwa mtazamo mmoja na ujue kinachofuata.',
    c3P2: 'Panga mapema kwa ujasiri — ili kazi kama kuweka mbolea zifanyike pale zao linapohitaji, si wiki moja baadaye.',
    c3Chip1: 'Ufuatiliaji wa hatua',
    c3Chip2: 'Panga mapema',
    c4Report: 'Ripoti ya msimu',
    c4Season: 'Masika 2026',
    c4Meta: 'Shamba la Maganzo · hekta 4.2',
    c4YieldLabel: 'Mavuno',
    c4YieldVal: 'tani 7.8',
    c4MarginLabel: 'Faida',
    c4Title: 'Ripoti ambazo benki yako itazichukulia kwa uzito',
    c4P1: 'Kutoka taarifa za shamba lako, BwanaShamba hutengeneza ripoti wazi za utendaji wa shamba na mazao, zinazohamishika kwa PDF na Excel.',
    c4P2: 'Changanua utendaji msimu kwa msimu na ushiriki kumbukumbu za kuaminika na taasisi ya kifedha unapotafuta mkopo kama mkulima mdogo.',
    c4Chip1: 'Hamisha PDF & Excel',
    c4Chip2: 'Tayari kwa mkopo',
    ctaTitle: 'Anza kutumia BwanaShamba leo',
    ctaSub: 'Bure kuanza. Jisajili kwa namba yako ya simu au barua pepe na ujenge wasifu wa shamba lako kwa dakika chache.',
    ctaBtn1: 'Fungua akaunti bure',
    ctaBtn2: 'Ingia',
    footerTagline: 'BwanaShamba, mfukoni mwako',
  },
} as const;

const STYLES = `
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }
/* Use the *visible* viewport height (dvh/svh) so full-height sections match
   the real device screen. Plain vh is the largest viewport (address bar
   hidden), which makes the hero taller than the screen on real phones. */
.lp-root { scroll-behavior: smooth; min-height: 100vh; min-height: 100dvh; }
.lp-hero { min-height: 100vh; min-height: 100svh; }
@keyframes lpBlink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes lpDotBounce { 0%,80%,100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-5px); opacity: 1; } }
@keyframes lpMsgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes lpScrollDot { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(14px); opacity: 0; } }
.lp-root [data-reveal] { opacity: 0; transform: translateY(44px); transition: opacity .85s ease, transform .85s cubic-bezier(.16,1,.3,1); }
.lp-root [data-reveal].in { opacity: 1; transform: none; }
.lp-root [data-reveal-2] { opacity: 0; transform: translateY(30px); transition: opacity .85s ease .14s, transform .85s cubic-bezier(.16,1,.3,1) .14s; }
.lp-root [data-reveal-2].in { opacity: 1; transform: none; }
.lp-root ::selection { background: #FFCC00; color: #1f2717; }
/* On mobile (rows stacked into one column), lead with the explanation,
   then the animation mockup. column-reverse flips the DOM order which is
   [mockup, explanation] → renders [explanation, mockup]. */
@media (max-width: 700px) {
  /* stretch: stacked boxes fill the column width so they don't resize
     horizontally as the animation swaps in wider/narrower content.
     nowrap keeps everything in a single column. */
  .lp-root .lp-cap { flex-direction: column-reverse !important; flex-wrap: nowrap !important; align-items: stretch !important; gap: 22px !important; }
  /* Drop the desktop-only top offset so the mockup sits right under its text. */
  .lp-root .lp-mock { margin-top: 0 !important; }
  /* Keep capabilities clearly separated, but tighter than on desktop so the
     page reads as four compact groups instead of floating blocks. */
  .lp-root .lp-caps { gap: 60px !important; }
}
`;

const card: React.CSSProperties = {
  position: 'relative', borderRadius: 26, background: 'rgba(12,30,18,0.86)',
  border: '1px solid rgba(255,204,0,0.28)',
  boxShadow: '0 30px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,204,0,0.12), 0 0 36px rgba(255,204,0,0.28)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
};
const cardGlow: React.CSSProperties = {
  position: 'absolute', inset: -1, borderRadius: 27,
  background: 'radial-gradient(120% 120% at 50% 0%, rgba(255,204,0,0.18), transparent 60%)', filter: 'blur(8px)',
};
const chip: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 999,
  background: 'rgba(232,239,222,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.86)',
};
const capIndex: React.CSSProperties = { fontSize: 13, fontWeight: 800, letterSpacing: '0.14em', color: '#FFCC00' };
const capTitle: React.CSSProperties = { margin: '10px 0 0', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08 };
const capPara: React.CSSProperties = { margin: '16px 0 0', fontSize: 'clamp(15px, 1.9vw, 18px)', lineHeight: 1.6, color: 'rgba(255,255,255,0.74)' };
const capPara2: React.CSSProperties = { ...capPara, margin: '14px 0 0' };

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [lang, setLang] = useState<Lang>('en');
  const [verbDisplay, setVerbDisplay] = useState('');
  const [shown, setShown] = useState(false);

  // Chat mockup state
  const [cu, setCu] = useState(false);
  const [cd, setCd] = useState(false);
  const [ca, setCa] = useState(false);
  const [cb, setCb] = useState(false);
  const [aiLen, setAiLen] = useState(0);

  const [tasks, setTasks] = useState(0);
  const [ms, setMs] = useState(0);
  const [rep, setRep] = useState(0);

  const langRef = useRef<Lang>(lang);
  langRef.current = lang;

  const s = STRINGS[lang];
  const rev = shown ? 'in' : '';

  // Typing headline verbs
  useEffect(() => {
    let active = true;
    const sleep = (m: number) => new Promise<void>(r => setTimeout(r, m));
    const run = async () => {
      let i = 0;
      while (active) {
        const verbs = STRINGS[langRef.current].verbs;
        const word = verbs[i % verbs.length];
        for (let c = 0; c <= word.length; c++) {
          if (!active) return;
          setVerbDisplay(word.slice(0, c));
          await sleep(58);
        }
        await sleep(1700);
        for (let c = word.length; c >= 0; c--) {
          if (!active) return;
          setVerbDisplay(word.slice(0, c));
          await sleep(29);
        }
        await sleep(280);
        i++;
      }
    };
    run();
    return () => { active = false; };
  }, []);

  // Chat mockup loop
  useEffect(() => {
    let active = true;
    const sleep = (m: number) => new Promise<void>(r => setTimeout(r, m));
    const run = async () => {
      while (active) {
        setCu(false); setCd(false); setCa(false); setCb(false); setAiLen(0);
        await sleep(800); if (!active) return;
        setCu(true);
        await sleep(1050); if (!active) return;
        setCd(true);
        await sleep(1500); if (!active) return;
        setCd(false); setCa(true); setAiLen(0);
        const aiText = STRINGS[langRef.current].c1Ai;
        for (let i = 0; i <= aiText.length; i++) {
          if (!active) return;
          setAiLen(i);
          await sleep(16);
        }
        await sleep(650); if (!active) return;
        setCb(true);
        await sleep(1100);
      }
    };
    run();
    return () => { active = false; };
  }, []);

  // Tasks loop
  useEffect(() => {
    let active = true;
    const sleep = (m: number) => new Promise<void>(r => setTimeout(r, m));
    const run = async () => {
      while (active) {
        setTasks(0);
        await sleep(600);
        for (let n = 1; n <= 3; n++) { if (!active) return; setTasks(n); await sleep(750); }
        await sleep(1100);
      }
    };
    run();
    return () => { active = false; };
  }, []);

  // Milestones loop
  useEffect(() => {
    let active = true;
    const sleep = (m: number) => new Promise<void>(r => setTimeout(r, m));
    const run = async () => {
      while (active) {
        setMs(0);
        await sleep(650);
        for (let n = 1; n <= 4; n++) { if (!active) return; setMs(n); await sleep(700); }
        await sleep(1100);
      }
    };
    run();
    return () => { active = false; };
  }, []);

  // Report loop
  useEffect(() => {
    let active = true;
    const sleep = (m: number) => new Promise<void>(r => setTimeout(r, m));
    const run = async () => {
      while (active) {
        setRep(0);
        await sleep(550);
        setRep(1);
        await sleep(1100); if (!active) return;
        setRep(2);
        await sleep(800); if (!active) return;
        setRep(3);
        await sleep(1100);
      }
    };
    run();
    return () => { active = false; };
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.lp-root [data-reveal], .lp-root [data-reveal-2]'));
    if (!('IntersectionObserver' in window) || els.length === 0) { setShown(true); return; }
    // Reveal everything currently near the top immediately so the hero isn't blank.
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('in');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    // Failsafe: ensure hero content shows even before observer fires.
    const t = setTimeout(() => setShown(true), 90);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);

  const aiText = s.c1Ai;
  const chatAiText = aiText.slice(0, Math.min(aiLen, aiText.length));
  const showCaret = ca && aiLen < aiText.length;
  const barWidth = ms >= 2 ? '44%' : '0%';
  const barScale = rep >= 1 ? 1 : 0;

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="lp-root"
        style={{
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          background: '#07170d', color: '#fff', overflowX: 'hidden',
        }}
      >
        {/* NAV */}
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'max(16px, env(safe-area-inset-top, 0px)) clamp(18px, 5vw, 54px) 16px',
          background: 'linear-gradient(180deg, rgba(4,12,7,0.72), rgba(4,12,7,0))',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.03em' }}>BwanaShamba</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <button
              onClick={() => { setLang(l => (l === 'en' ? 'sw' : 'en')); setVerbDisplay(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '0 15px',
                borderRadius: 999, background: 'rgba(232,239,222,0.08)', border: '1px solid rgba(255,255,255,0.16)',
                color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              }}
            >
              {lang === 'en' ? 'Kiswahili' : 'English'}
            </button>
            <button
              onClick={() => onEnter('signin')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40, padding: '0 20px',
                borderRadius: 999, background: '#FFCC00', color: '#1f2717', fontWeight: 800, fontSize: 13,
                border: 0, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 26px rgba(0,0,0,0.28)',
              }}
            >
              {s.signIn}
            </button>
          </div>
        </header>

        {/* HERO */}
        <section className="lp-hero" style={{ position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <img
              src="/assets/landing-vegetables.jpg" alt="" aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                objectPosition: '50% 50%', filter: 'saturate(1.1) contrast(1.05)',
              }}
            />
          </div>
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(3,8,4,0.32) 0%, rgba(5,14,8,0.30) 30%, rgba(3,12,6,0.78) 72%, rgba(4,12,7,0.99) 100%), linear-gradient(90deg, rgba(4,15,8,0.55), transparent 60%)',
          }} />

          <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 1180, margin: '0 auto', padding: '96px clamp(20px, 5vw, 54px) 60px' }}>
            <div style={{ maxWidth: 760 }}>
              <h1 data-reveal className={rev} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04, fontSize: 'clamp(36px, 6.8vw, 72px)' }}>
                {s.heroLine1}
                <span style={{ display: 'block', whiteSpace: 'nowrap', marginTop: 6, lineHeight: 1.1 }}>
                  <span style={{ color: '#FFCC00' }}>{verbDisplay}</span>
                  <span style={{ display: 'inline-block', width: 4, height: '0.86em', verticalAlign: '-0.06em', marginLeft: 4, background: '#FFCC00', animation: 'lpBlink 1s steps(2) infinite' }} />
                </span>
              </h1>

              <p data-reveal-2 className={rev} style={{ margin: '24px 0 0', maxWidth: 560, fontSize: 'clamp(16px, 2.2vw, 20px)', lineHeight: 1.55, color: 'rgba(255,255,255,0.80)', fontWeight: 400 }}>
                {s.heroSub}
              </p>

              <div data-reveal-2 className={rev} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 34 }}>
                <button
                  onClick={() => onEnter('register')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 52, padding: '0 28px',
                    borderRadius: 999, background: '#FFCC00', color: '#1f2717', fontWeight: 800, fontSize: 15,
                    border: 0, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 18px 34px rgba(0,0,0,0.34)',
                  }}
                >
                  {s.heroCta1}
                </button>
                <button onClick={() => onEnter('chat')} style={{
                  display: 'flex', alignItems: 'center', gap: 9, minHeight: 52, padding: '0 24px', borderRadius: 999,
                  background: 'rgba(232,239,222,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff',
                  fontWeight: 700, fontSize: 15, textDecoration: 'none',
                  backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {s.heroCta2}
                </button>
              </div>
            </div>
          </div>

          <a href="#capabilities" aria-label="Scroll" style={{
            position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            width: 26, height: 42, borderRadius: 999, border: '1.5px solid rgba(255,255,255,0.4)',
            display: 'flex', justifyContent: 'center', paddingTop: 8,
          }}>
            <span style={{ width: 4, height: 8, borderRadius: 999, background: '#fff', animation: 'lpScrollDot 1.6s ease-in-out infinite' }} />
          </a>
        </section>

        {/* CAPABILITIES INTRO */}
        <section id="capabilities" style={{ position: 'relative', padding: 'clamp(72px, 11vw, 130px) clamp(20px, 5vw, 54px) 30px', maxWidth: 1180, margin: '0 auto' }}>
          <div data-reveal className={rev} style={{ maxWidth: 720 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#FFCC00' }}>{s.introEyebrow}</span>
            <h2 style={{ margin: '16px 0 0', fontSize: 'clamp(30px, 5.2vw, 52px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{s.introTitle}</h2>
            <p style={{ margin: '18px 0 0', fontSize: 'clamp(15px, 2vw, 18px)', lineHeight: 1.6, color: 'rgba(255,255,255,0.72)' }}>{s.introSub}</p>
          </div>
        </section>

        {/* CAPABILITY ROWS */}
        <div className="lp-caps" style={{ maxWidth: 1180, margin: '0 auto', padding: '20px clamp(20px, 5vw, 54px) 0', display: 'flex', flexDirection: 'column', gap: 'clamp(70px, 11vw, 140px)' }}>

          {/* CAP 01 — AI CHAT */}
          <div className="lp-cap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'clamp(36px, 6vw, 80px)' }}>
            <div data-reveal className={rev} style={{ flex: '1 1 360px', minWidth: 300 }}>
              <div className="lp-mock" style={{ position: 'relative', width: '100%', maxWidth: 480, marginTop: 38 }}>
                <div style={cardGlow} />
                <div style={{ ...card, padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 15, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, background: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1f2717" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></svg>
                    </div>
                    <strong style={{ fontSize: 15.5, letterSpacing: '-0.01em' }}>{s.c1Header}</strong>
                  </div>
                  {/* Fixed height (sized to the fullest animated state, per language)
                      so the card never resizes as messages stream in. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 18, height: lang === 'sw' ? 380 : 332, overflow: 'hidden' }}>
                    {cu && (
                      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '11px 16px', borderRadius: '16px 16px 5px 16px', background: '#FFCC00', color: '#1f2717', fontSize: 14.5, lineHeight: 1.42, fontWeight: 500, animation: 'lpMsgIn .3s ease both' }}>{s.c1User}</div>
                    )}
                    {cd && (
                      <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '14px 16px', borderRadius: '16px 16px 16px 5px', background: 'rgba(255,255,255,0.12)', animation: 'lpMsgIn .3s ease both' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.65)', animation: 'lpDotBounce 1.1s 0ms infinite' }} />
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.65)', animation: 'lpDotBounce 1.1s 160ms infinite' }} />
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.65)', animation: 'lpDotBounce 1.1s 320ms infinite' }} />
                      </div>
                    )}
                    {ca && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '88%', padding: '12px 16px', borderRadius: '16px 16px 16px 5px', background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 14.5, lineHeight: 1.5, animation: 'lpMsgIn .3s ease both' }}>
                        {chatAiText}
                        {showCaret && <span style={{ display: 'inline-block', width: 3, height: '0.95em', verticalAlign: '-0.12em', marginLeft: 2, background: '#ffe08a', animation: 'lpBlink 1s steps(2) infinite' }} />}
                      </div>
                    )}
                    {cb && (
                      <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '88%', padding: '9px 14px', borderRadius: 999, background: 'rgba(255,204,0,0.14)', border: '1px dashed rgba(255,204,0,0.45)', color: '#ffe08a', fontSize: 12.5, fontWeight: 600, animation: 'lpMsgIn .35s ease both' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18" /><path d="m14 5 7 7-7 7" /></svg>
                        {s.c1Beyond}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div data-reveal-2 className={rev} style={{ flex: '1 1 380px', minWidth: 300 }}>
              <span style={capIndex}>01</span>
              <h3 style={capTitle}>{s.c1Title}</h3>
              <p style={capPara}>{s.c1P1}</p>
              <p style={capPara2}>{s.c1P2}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                <span style={chip}>{s.c1Chip1}</span>
                <span style={chip}>{s.c1Chip2}</span>
                <span style={chip}>{s.c1Chip3}</span>
              </div>
            </div>
          </div>

          {/* CAP 02 — DAILY RECOMMENDATIONS */}
          <div className="lp-cap" style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 'clamp(36px, 6vw, 80px)' }}>
            <div data-reveal className={rev} style={{ flex: '1 1 360px', minWidth: 300 }}>
              <div className="lp-mock" style={{ position: 'relative', width: '100%', maxWidth: 410, marginLeft: 'auto', marginTop: 38, zoom: 1.17 } as React.CSSProperties}>
                <div style={cardGlow} />
                <div style={{ ...card, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#FFCC00' }}>{s.c2Today}</div>
                      <strong style={{ fontSize: 17, letterSpacing: '-0.02em' }}>{s.c2Date}</strong>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{s.c2Tasks}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, height: 218, overflow: 'hidden' }}>
                    {tasks >= 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: 'rgba(255,204,0,0.12)', border: '1px solid rgba(255,204,0,0.30)', animation: 'lpMsgIn .4s ease both' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFCC00', flexShrink: 0, boxShadow: '0 0 8px rgba(255,204,0,0.7)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.c2T1}</div>
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{s.c2T1Sub}</div>
                        </div>
                      </div>
                    )}
                    {tasks >= 2 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: 'rgba(255,255,255,0.06)', animation: 'lpMsgIn .4s ease both' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.c2T2}</div>
                          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{s.c2T2Sub}</div>
                        </div>
                      </div>
                    )}
                    {tasks >= 3 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, background: 'rgba(255,255,255,0.06)', animation: 'lpMsgIn .4s ease both' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{s.c2T3}</div>
                          <div style={{ fontSize: 10.5, color: '#ffe08a', marginTop: 1 }}>{s.c2T3Sub}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div data-reveal-2 className={rev} style={{ flex: '1 1 380px', minWidth: 300 }}>
              <span style={capIndex}>02</span>
              <h3 style={capTitle}>{s.c2Title}</h3>
              <p style={capPara}>{s.c2P1}</p>
              <p style={capPara2}>{s.c2P2}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                <span style={chip}>{s.c2Chip1}</span>
                <span style={chip}>{s.c2Chip2}</span>
              </div>
            </div>
          </div>

          {/* CAP 03 — MILESTONES */}
          <div className="lp-cap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'clamp(36px, 6vw, 80px)' }}>
            <div data-reveal className={rev} style={{ flex: '1 1 360px', minWidth: 300 }}>
              <div className="lp-mock" style={{ position: 'relative', width: '100%', maxWidth: 410, marginTop: 38, zoom: 1.17 } as React.CSSProperties}>
                <div style={cardGlow} />
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <strong style={{ fontSize: 14, letterSpacing: '-0.01em' }}>{s.c3Crop}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#FFCC00' }}>{s.c3Day}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginBottom: 18 }}>
                    <div style={{ width: barWidth, height: '100%', borderRadius: 999, background: '#FFCC00', transition: 'width 1.1s cubic-bezier(.16,1,.3,1)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 228, overflow: 'hidden' }}>
                    {ms >= 1 && (
                      <div style={{ display: 'flex', gap: 12, animation: 'lpMsgIn .4s ease both' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#FFCC00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1f2717" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                          <span style={{ width: 2, flex: 1, background: '#FFCC00' }} />
                        </div>
                        <div style={{ paddingBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.c3M1}</div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{s.c3M1Sub}</div></div>
                      </div>
                    )}
                    {ms >= 2 && (
                      <div style={{ display: 'flex', gap: 12, animation: 'lpMsgIn .4s ease both' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,204,0,0.18)', border: '2px solid #FFCC00', flexShrink: 0 }} />
                          <span style={{ width: 2, flex: 1, background: 'rgba(255,255,255,0.14)' }} />
                        </div>
                        <div style={{ paddingBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFCC00' }}>{s.c3M2}</div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 10.5, fontWeight: 600, padding: '4px 9px', borderRadius: 999, background: 'rgba(255,204,0,0.14)', border: '1px dashed rgba(255,204,0,0.45)', color: '#ffe08a' }}>{s.c3Key}</div>
                        </div>
                      </div>
                    )}
                    {ms >= 3 && (
                      <div style={{ display: 'flex', gap: 12, animation: 'lpMsgIn .4s ease both' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                          <span style={{ width: 2, flex: 1, background: 'rgba(255,255,255,0.14)' }} />
                        </div>
                        <div style={{ paddingBottom: 16 }}><div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>{s.c3M3}</div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{s.c3M3Sub}</div></div>
                      </div>
                    )}
                    {ms >= 4 && (
                      <div style={{ display: 'flex', gap: 12, animation: 'lpMsgIn .4s ease both' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        </div>
                        <div><div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>{s.c3M4}</div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{s.c3M4Sub}</div></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div data-reveal-2 className={rev} style={{ flex: '1 1 380px', minWidth: 300 }}>
              <span style={capIndex}>03</span>
              <h3 style={capTitle}>{s.c3Title}</h3>
              <p style={capPara}>{s.c3P1}</p>
              <p style={capPara2}>{s.c3P2}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                <span style={chip}>{s.c3Chip1}</span>
                <span style={chip}>{s.c3Chip2}</span>
              </div>
            </div>
          </div>

          {/* CAP 04 — REPORTS */}
          <div className="lp-cap" style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 'clamp(36px, 6vw, 80px)' }}>
            <div data-reveal className={rev} style={{ flex: '1 1 360px', minWidth: 300 }}>
              <div className="lp-mock" style={{ position: 'relative', width: '100%', maxWidth: 410, marginLeft: 'auto', marginTop: 38, zoom: 1.17 } as React.CSSProperties}>
                <div style={cardGlow} />
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong style={{ fontSize: 14, letterSpacing: '-0.01em' }}>{s.c4Report}</strong>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>{s.c4Season}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>{s.c4Meta}</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 92, padding: '0 2px 10px', borderBottom: '1px solid rgba(255,255,255,0.10)', marginBottom: 14 }}>
                    <div style={{ flex: 1, height: '46%', borderRadius: '5px 5px 0 0', background: 'rgba(255,255,255,0.18)', transformOrigin: 'bottom', transform: `scaleY(${barScale})`, transition: 'transform .65s cubic-bezier(.16,1,.3,1) 0ms' }} />
                    <div style={{ flex: 1, height: '62%', borderRadius: '5px 5px 0 0', background: 'rgba(255,255,255,0.22)', transformOrigin: 'bottom', transform: `scaleY(${barScale})`, transition: 'transform .65s cubic-bezier(.16,1,.3,1) 90ms' }} />
                    <div style={{ flex: 1, height: '54%', borderRadius: '5px 5px 0 0', background: 'rgba(255,255,255,0.18)', transformOrigin: 'bottom', transform: `scaleY(${barScale})`, transition: 'transform .65s cubic-bezier(.16,1,.3,1) 180ms' }} />
                    <div style={{ flex: 1, height: '78%', borderRadius: '5px 5px 0 0', background: 'rgba(255,204,0,0.55)', transformOrigin: 'bottom', transform: `scaleY(${barScale})`, transition: 'transform .65s cubic-bezier(.16,1,.3,1) 270ms' }} />
                    <div style={{ flex: 1, height: '100%', borderRadius: '5px 5px 0 0', background: '#FFCC00', transformOrigin: 'bottom', transform: `scaleY(${barScale})`, transition: 'transform .65s cubic-bezier(.16,1,.3,1) 360ms' }} />
                  </div>
                  <div style={{ height: 124, overflow: 'hidden' }}>
                    {rep >= 2 && (
                      <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'lpMsgIn .4s ease both' }}>
                        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{s.c4YieldLabel}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{s.c4YieldVal}</div>
                        </div>
                        <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)' }}>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{s.c4MarginLabel}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2, color: '#FFCC00' }}>+32%</div>
                        </div>
                      </div>
                    )}
                    {rep >= 3 && (
                      <div style={{ display: 'flex', gap: 9, animation: 'lpMsgIn .4s ease both' }}>
                        <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 11, background: '#FFCC00', color: '#1f2717', fontSize: 12, fontWeight: 800 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                          PDF
                        </span>
                        <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                          Excel
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div data-reveal-2 className={rev} style={{ flex: '1 1 380px', minWidth: 300 }}>
              <span style={capIndex}>04</span>
              <h3 style={capTitle}>{s.c4Title}</h3>
              <p style={capPara}>{s.c4P1}</p>
              <p style={capPara2}>{s.c4P2}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 22 }}>
                <span style={chip}>{s.c4Chip1}</span>
                <span style={chip}>{s.c4Chip2}</span>
              </div>
            </div>
          </div>

        </div>

        {/* CTA */}
        <section style={{ position: 'relative', margin: 'clamp(80px, 12vw, 150px) auto 0', maxWidth: 1180, padding: '0 clamp(20px, 5vw, 54px)' }}>
          <div data-reveal className={rev} style={{ position: 'relative', overflow: 'hidden', borderRadius: 30, padding: 'clamp(40px, 7vw, 72px) clamp(28px, 6vw, 64px)', background: 'linear-gradient(135deg, rgba(12,30,18,0.96), rgba(8,22,13,0.96))', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 140% at 100% 0%, rgba(255,204,0,0.16), transparent 55%)' }} />
            <div style={{ position: 'relative', maxWidth: 640 }}>
              <h2 style={{ margin: 0, fontSize: 'clamp(30px, 5.2vw, 54px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.04 }}>{s.ctaTitle}</h2>
              <p style={{ margin: '18px 0 0', fontSize: 'clamp(15px, 2vw, 19px)', lineHeight: 1.6, color: 'rgba(255,255,255,0.74)' }}>{s.ctaSub}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 30 }}>
                <button onClick={() => onEnter('register')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 54, padding: '0 30px', borderRadius: 999, background: '#FFCC00', color: '#1f2717', fontWeight: 800, fontSize: 15, border: 0, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 18px 34px rgba(0,0,0,0.34)' }}>{s.ctaBtn1}</button>
                <button onClick={() => onEnter('signin')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 54, padding: '0 28px', borderRadius: 999, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{s.ctaBtn2}</button>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ maxWidth: 1180, margin: 'clamp(56px, 8vw, 96px) auto 0', padding: 'clamp(48px, 7vw, 80px) clamp(20px, 5vw, 54px) 48px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em' }}>BwanaShamba</span>
          </div>
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{s.footerTagline}</span>
        </footer>
      </div>
    </>
  );
}
