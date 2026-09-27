"""Builds one self-contained, time-seekable HTML page per (video, language).
All motion is CSS animations with absolute delays; window.seek(t) pauses every
animation at t and updates JS-driven counters/typing, so frames are deterministic."""
import json, os, html
from scripts import VIDEOS, strip_ar

FPS = 30
GAP = 0.5
LEAD = 0.35         # audio offset inside a scene
MIN_SCENE = 3.0
END_HOLD = 1.2

FONTS = os.path.abspath(os.environ.get('SOPY_FONTS', 'fonts'))
def ff(pkg, file):
    return f"file://{FONTS}/{pkg}/files/{file}"
FONT_CSS = ""
for fam, pkg, pre, subsets in [
    ("Plex", "fontsource-ibm-plex-sans-5.3.0", "ibm-plex-sans", ["latin"]),
    ("PlexAr", "fontsource-ibm-plex-sans-arabic-5.3.0", "ibm-plex-sans-arabic", ["arabic", "latin"]),
]:
    for w in (400, 600, 700):
        for s in subsets:
            FONT_CSS += f"@font-face{{font-family:{fam};font-weight:{w};src:url({ff(pkg, f'{pre}-{s}-{w}-normal.woff2')});}}\n"
FONT_CSS += f"@font-face{{font-family:Serif4;font-weight:700;src:url({ff('fontsource-source-serif-4-5.3.0','source-serif-4-latin-700-normal.woff2')});}}\n"
FONT_CSS += f"@font-face{{font-family:Mono;font-weight:500;src:url({ff('fontsource-ibm-plex-mono-5.3.0','ibm-plex-mono-latin-500-normal.woff2')});}}\n"

ICON = {
 'check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
 'alert': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
 'camera': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="4"/></svg>',
 'lock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
 'pin': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 22s7-7.5 7-12.5A7 7 0 005 9.5C5 14.5 12 22 12 22z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
 'clock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
 'share': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/></svg>',
 'link': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>',
 'search': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
 'x': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 'plus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 'minus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/></svg>',
 'img': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
}
def ic(name, cls=''):
    return f'<span class="ic {cls}">{ICON[name]}</span>'

CSS = r"""
:root{--ink:#1c231f;--ink-soft:#4a534d;--paper:#f4efe6;--white:#fff;--line:#d9d2c3;--green:#1c3d2e;--green-dark:#12271d;
--green-tint:#e7ede9;--amber:#b5651d;--amber-tint:#f7e9da;--amber-text:#8a4a12;--red:#a13a2f;--red-tint:#f7e4e1;--ok:#2f7a4f}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--paper);color:var(--ink)}
body{font-family:Plex,PlexAr,sans-serif;position:relative}
body.ar{font-family:PlexAr,Plex,sans-serif}
.bg{position:absolute;inset:0;background:
 radial-gradient(1200px 900px at 85% -10%, rgba(28,61,46,.10), transparent 60%),
 radial-gradient(900px 700px at -10% 110%, rgba(181,101,29,.10), transparent 60%),
 repeating-linear-gradient(0deg, rgba(28,35,31,.035) 0 1px, transparent 1px 56px),
 repeating-linear-gradient(90deg, rgba(28,35,31,.035) 0 1px, transparent 1px 56px), var(--paper)}
.top{position:absolute;top:84px;left:72px;right:72px;display:flex;align-items:center;justify-content:space-between;z-index:5}
.logo{display:flex;align-items:center;gap:16px;font-family:Serif4,serif;font-weight:700;font-size:54px;color:var(--green);letter-spacing:1px;direction:ltr}
.logo .mark{width:60px;height:60px;border-radius:14px;background:var(--green);color:#fff;display:grid;place-items:center}
.logo .mark .ic{width:38px;height:38px}
.chip{font-family:Mono,monospace;font-size:24px;font-weight:500;letter-spacing:1px;color:var(--green);background:var(--green-tint);border:2px solid rgba(28,61,46,.25);padding:10px 18px;border-radius:8px;direction:ltr}
.eptitle{position:absolute;top:176px;left:72px;right:72px;font-size:30px;font-weight:600;color:var(--ink-soft);z-index:5}
.prog{position:absolute;top:228px;left:72px;right:72px;height:6px;border-radius:3px;background:rgba(28,61,46,.12);overflow:hidden;z-index:5}
.prog i{position:absolute;inset:0;background:var(--green);transform-origin:left;transform:scaleX(0)}
body.ar .prog i{transform-origin:right}
.scene{position:absolute;inset:0;opacity:0}
.stage{position:absolute;top:270px;left:0;right:0;height:1110px;display:flex;align-items:center;justify-content:center}
.cap{position:absolute;top:1420px;left:80px;right:80px;display:flex;justify-content:center}
.cap div{background:var(--green);color:#fff;font-size:46px;line-height:1.32;font-weight:600;padding:30px 40px;border-radius:22px;text-align:center;box-shadow:0 14px 34px rgba(18,39,29,.25)}
body.ar .cap div{font-size:48px;line-height:1.5}
.ic{display:inline-grid;width:1em;height:1em;flex:none}.ic svg{width:100%;height:100%}

/* phone */
.phone{width:640px;height:1100px;border-radius:78px;background:var(--green-dark);padding:18px;box-shadow:0 40px 80px rgba(18,39,29,.35),0 0 0 3px #2a4a3a inset;position:relative}
.screen{width:100%;height:100%;border-radius:62px;background:var(--paper);overflow:hidden;position:relative}
.notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:170px;height:40px;background:var(--green-dark);border-radius:22px;z-index:3}
.status{height:74px}
.apphead{background:var(--green);color:#fff;padding:22px 34px 26px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.apphead h3{font-size:32px;font-weight:700;line-height:1.2}
.apphead .code{font-family:Mono,monospace;font-size:20px;background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.35);padding:6px 10px;border-radius:6px;direction:ltr;white-space:nowrap}
.body{padding:26px 28px}
.sub{font-size:22px;color:var(--ink-soft);font-weight:600;margin:4px 4px 16px;text-transform:uppercase;letter-spacing:1px}
body.ar .sub{text-transform:none;letter-spacing:0;font-size:24px}
.card{background:#fff;border:2px solid var(--line);border-radius:18px;padding:20px 22px;margin-bottom:16px;display:flex;align-items:center;gap:18px;box-shadow:0 2px 4px rgba(28,35,31,.05)}
.card .t{font-size:27px;font-weight:600;line-height:1.25}
.card .s{font-size:21px;color:var(--ink-soft);margin-top:4px}
.grow{flex:1;min-width:0}
.pill{font-size:20px;font-weight:700;padding:7px 14px;border-radius:999px;white-space:nowrap}
.p-green{background:var(--green-tint);color:var(--green)}.p-amber{background:var(--amber-tint);color:var(--amber-text)}.p-red{background:var(--red-tint);color:var(--red)}
.tick{width:46px;height:46px;border-radius:12px;border:3px solid var(--line);display:grid;place-items:center;color:#fff;flex:none;position:relative;background:#fff}
.tick .fill{position:absolute;inset:-3px;border-radius:12px;background:var(--ok);display:grid;place-items:center;opacity:0}
.tick .fill .ic{width:30px;height:30px}
.btn{background:var(--green);color:#fff;font-size:27px;font-weight:700;border-radius:16px;padding:22px;text-align:center}
.btn.ghost{background:#fff;color:var(--green);border:2.5px solid var(--green)}
.mono{font-family:Mono,monospace;direction:ltr;unicode-bidi:isolate}
table.tl{width:100%;border-collapse:separate;border-spacing:0 10px}
.tl th{font-size:19px;color:var(--ink-soft);font-weight:600;text-align:center;padding:0 4px}
.tl th:first-child{text-align:start}
.tl td{background:#fff;border-top:2px solid var(--line);border-bottom:2px solid var(--line);height:88px;text-align:center;font-size:28px;font-weight:700;position:relative}
.tl td:first-child{text-align:start;padding:0 16px;border-inline-start:2px solid var(--line);border-start-start-radius:14px;border-end-start-radius:14px;font-size:23px;font-weight:600;line-height:1.2}
.tl td:last-child{border-inline-end:2px solid var(--line);border-start-end-radius:14px;border-end-end-radius:14px}
.tl td small{display:block;font-size:17px;color:var(--ink-soft);font-weight:500}
.tl .cell{position:absolute;inset:10px 6px;border-radius:10px;display:grid;place-items:center;opacity:0}
.tl .cell.g{background:var(--green-tint);color:var(--green)}
.tl .cell.r{background:var(--red);color:#fff}
.banner{border-radius:16px;padding:20px 22px;display:flex;gap:16px;align-items:flex-start;font-size:24px;font-weight:600;line-height:1.35}
.banner .ic{width:36px;height:36px;margin-top:2px}
.b-red{background:var(--red);color:#fff}.b-green{background:var(--green);color:#fff}.b-amber{background:var(--amber);color:#fff}
.bar{height:16px;border-radius:8px;background:rgba(28,61,46,.12);overflow:hidden;position:relative}
.bar i{position:absolute;inset:0;background:var(--ok);transform-origin:left;transform:scaleX(0)}
body.ar .bar i{transform-origin:right}
.tabbar{position:absolute;bottom:0;left:0;right:0;height:104px;background:#fff;border-top:2px solid var(--line);display:flex;justify-content:space-around;align-items:center;font-size:20px;font-weight:600;color:var(--ink-soft)}
.tabbar b{color:var(--green)}
.tapdot{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:rgba(28,61,46,.28);border:4px solid rgba(28,61,46,.6);opacity:0;z-index:9;pointer-events:none}

/* big text scenes */
.hook{padding:0 90px;text-align:start;width:100%}
.hook .k{font-family:Mono,monospace;font-size:30px;color:var(--amber-text);letter-spacing:3px;margin-bottom:34px;direction:ltr;display:inline-block}
.hook h1{font-family:Serif4,serif;font-size:112px;line-height:1.08;color:var(--green);font-weight:700;white-space:pre-line}
body.ar .hook h1{font-family:PlexAr,sans-serif;font-size:100px;line-height:1.35}
.hook .ul{height:14px;background:var(--amber);border-radius:7px;margin-top:40px;width:260px;transform:scaleX(0);transform-origin:left}
body.ar .hook .ul{transform-origin:right}
.bul{width:100%;padding:0 100px}
.bul .row{display:flex;align-items:center;gap:30px;margin:0 0 44px;font-size:62px;font-weight:700;color:var(--green)}
.bul .row .dot{width:92px;height:92px;border-radius:24px;background:var(--green);color:#fff;display:grid;place-items:center;flex:none}
.bul .row .dot .ic{width:56px;height:56px}
.cta{text-align:center;width:100%}
.cta .logo{justify-content:center;font-size:190px;gap:40px}
.cta .logo .mark{width:200px;height:200px;border-radius:46px}
.cta .logo .mark .ic{width:130px;height:130px}
.cta h2{font-size:64px;margin-top:60px;color:var(--ink);font-weight:700;padding:0 60px;line-height:1.3}
.cta p{font-size:40px;color:var(--ink-soft);margin-top:26px}
.cta .btn{display:inline-block;margin-top:70px;font-size:44px;padding:34px 80px;border-radius:24px}
.thr{width:100%;padding:0 90px}
.thr .r{display:flex;align-items:center;gap:36px;border-radius:30px;padding:40px 44px;margin-bottom:34px;color:#fff}
.thr .r b{font-size:64px;font-weight:700;min-width:300px}
.thr .r span{font-size:54px;font-weight:700;direction:ltr;unicode-bidi:isolate}
.paper{position:absolute;width:300px;height:390px;background:#fff;border:2px solid var(--line);border-radius:10px;box-shadow:0 14px 30px rgba(28,35,31,.14);padding:34px 28px}
.paper i{display:block;height:12px;background:#e5dfd2;border-radius:6px;margin-bottom:22px}
.stamp{position:absolute;font-size:44px;font-weight:700;color:var(--red);border:6px solid var(--red);border-radius:14px;padding:6px 20px;opacity:0;background:rgba(255,255,255,.85)}

@keyframes sIn{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
@keyframes sOut{from{opacity:1}to{opacity:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes collapse{from{opacity:1;max-height:140px}to{opacity:0;max-height:0;padding-top:0;padding-bottom:0;margin-bottom:0;border-width:0}}
@keyframes fadeOut{from{opacity:1}to{opacity:0}}
@keyframes pop{0%{opacity:0;transform:scale(.4)}70%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@keyframes scaleX{from{transform:scaleX(0)}to{transform:scaleX(var(--to,1))}}
@keyframes ring{from{stroke-dashoffset:var(--c)}to{stroke-dashoffset:var(--o)}}
@keyframes tap{0%{opacity:0;transform:scale(1.6)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.9)}}
@keyframes hl{from{background:#fff;border-color:var(--line)}to{background:var(--green-tint);border-color:var(--green)}}
@keyframes toRed{to{stroke:var(--red)}}
@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
@keyframes flash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
@keyframes fall{from{transform:translate(0,0) rotate(var(--r0))}to{transform:translate(var(--dx),900px) rotate(var(--r1));opacity:.0}}
@keyframes floatIn{from{opacity:0;transform:translateY(-40px) rotate(var(--r0))}to{opacity:1;transform:rotate(var(--r0))}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(161,58,47,.5)}50%{box-shadow:0 0 0 18px rgba(161,58,47,0)}}
@keyframes growH{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes strike{from{transform:scaleX(0)}to{transform:scaleX(1)}}
"""

class Ctx:
    def __init__(s, lang, S, D): s.lang, s.S, s.D = lang, S, D
    def L(s, en, ar): return ar if s.lang == 'ar' else en
    def a(s, name, dur, off, ease='cubic-bezier(.2,.8,.2,1)', fill='both', extra=''):
        return f"{name} {dur}s {ease} {s.S+off:.3f}s {fill}{extra}"
    def st(s, *anims, style=''):
        return f'style="animation:{", ".join(anims)};{style}"'
    def t(s, off): return s.S + off

def tapdot(c, x, y, off):
    return f'<div class="tapdot" style="left:{x}px;top:{y}px;animation:{c.a("tap",.7,off,"ease-out")}"></div>'

def tickbox(c, off):
    return f'<div class="tick"><div class="fill" {c.st(c.a("pop",.45,off))}>{ic("check")}</div></div>'

def counter(c, frm, to, off, dur, suffix='', dec=0, cls=''):
    return f'<span class="cnt {cls}" data-from="{frm}" data-to="{to}" data-start="{c.t(off)}" data-dur="{dur}" data-dec="{dec}" data-suf="{suffix}">{frm}{suffix}</span>'

def typer(c, text, off, dur):
    return f'<span class="typ" data-text="{html.escape(text)}" data-start="{c.t(off)}" data-dur="{dur}"></span>'

def phone(c, title, code, body, tabs=True, head=True):
    tb = ''
    if tabs:
        tb = f'<div class="tabbar"><b>{c.L("Home","الرئيسية")}</b><span>{c.L("Kitchen","المطبخ")}</span><span>{c.L("Bar","البار")}</span><span>{c.L("KPI","المؤشرات")}</span></div>'
    hd = f'<div class="apphead"><h3>{title}</h3>{f"<span class=code>{code}</span>" if code else ""}</div>' if head else ''
    return f'<div class="phone" {c.st(c.a("fadeUp",.6,0))}><div class="screen"><div class="notch"></div><div class="status"></div>{hd}<div class="body">{body}</div>{tb}</div></div>'

def ring(c, pct, color, off, size=150, dur=1.6, label='', red_at=None):
    r = 58; C = 2*3.14159*r; o = C*(1-pct/100)
    extra = f', {c.a("toRed",.4,red_at,"linear","forwards")}' if red_at is not None else ''
    return f'''<div style="display:flex;flex-direction:column;align-items:center;gap:10px">
<div style="position:relative;width:{size}px;height:{size}px"><svg viewBox="0 0 140 140" width="{size}" height="{size}" style="transform:rotate(-90deg)">
<circle cx="70" cy="70" r="{r}" fill="none" stroke="rgba(28,61,46,.12)" stroke-width="14"/>
<circle cx="70" cy="70" r="{r}" fill="none" stroke="{color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="{C:.1f}" style="--c:{C:.1f};--o:{o:.1f};stroke-dashoffset:{C:.1f};animation:{c.a("ring",dur,off,"cubic-bezier(.3,.7,.2,1)")}{extra}"/></svg>
<div style="position:absolute;inset:0;display:grid;place-items:center;font-size:{int(size*.25)}px;font-weight:700">{counter(c,0,pct,off,dur,"%")}</div></div>
<div style="font-size:22px;font-weight:600;color:var(--ink-soft)">{label}</div></div>'''

# ---------------------------------------------------------------- screens
def scr_home(c):
    rows = [(c.L("Kitchen daily report","تقرير المطبخ اليومي"),"KDR-001",c.L("Done","مكتمل"),"p-green",True),
            (c.L("Bar & beverage report","تقرير البار والمشروبات"),"BDR-001",c.L("In progress","قيد التنفيذ"),"p-amber",False),
            (c.L("Daily opening report","تقرير الافتتاح اليومي"),"OPEN",c.L("Done","مكتمل"),"p-green",True),
            (c.L("QC visit report","تقرير زيارة الجودة"),"QC-D-001",c.L("Due 4 PM","مستحق 4 م"),"p-red",False)]
    b = f'<div class="sub">{c.L("My checklists today","قوائمي اليوم")}</div>'
    for i,(t,code,st,pc,done) in enumerate(rows):
        o = .5 + i*.55
        tk = tickbox(c, o+.9) if done else '<div class="tick"></div>'
        b += f'<div class="card" {c.st(c.a("fadeUp",.5,o))}>{tk}<div class="grow"><div class="t">{t}</div><div class="s mono">{code}</div></div><span class="pill {pc}">{st}</span></div>'
    b += f'<div class="btn" style="margin-top:24px" {c.st(c.a("fadeUp",.5,3.0))}>{c.L("Start QC visit","ابدأ زيارة الجودة")}</div>'
    return phone(c, c.L("Dashboard","لوحة التحكم"), c.L("Zamalek","الزمالك"), b)

def scr_rings(c):
    b = f'<div class="sub">{c.L("Compliance today","الالتزام اليوم")}</div>'
    b += f'<div class="card" style="justify-content:space-around;padding:30px 10px" {c.st(c.a("fadeUp",.5,.3))}>'
    b += ring(c,97,'var(--ok)',.6,label=c.L("Kitchen","المطبخ")) + ring(c,92,'var(--amber)',.9,label=c.L("Bar","البار")) + ring(c,96,'var(--ok)',1.2,label=c.L("QC walk","جولة الجودة"))
    b += '</div>'
    b += f'<div class="sub" style="margin-top:26px">{c.L("Alerts","التنبيهات")}</div>'
    b += f'<div class="banner b-red" {c.st(c.a("fadeUp",.5,2.4), c.a("shake",.5,2.9,"ease-in-out"))}>{ic("alert")}<div>{c.L("Walk-in chiller at 8°C — safe range 0–5°C","غرفة التبريد 8°م — النطاق الآمن 0–5°م")}<div style="font-size:20px;opacity:.85;margin-top:4px">{c.L("Kitchen · Zamalek · 11:20","المطبخ · الزمالك · 11:20")}</div></div></div>'
    b += f'<div class="card" style="margin-top:16px" {c.st(c.a("fadeUp",.5,3.3))}><span class="pill p-green">{c.L("GREEN","أخضر")}</span><div class="grow t">{c.L("New Cairo — all reports in","القاهرة الجديدة — كل التقارير مكتملة")}</div></div>'
    return phone(c, c.L("KPI dashboard","لوحة مؤشرات الأداء"), "", b)

def scr_stores(c):
    b = f'<div style="display:flex;gap:10px;margin-bottom:22px" {c.st(c.a("fadeIn",.4,.2))}>' + ''.join(f'<div style="flex:1;height:10px;border-radius:5px;background:{"var(--green)" if i==0 else "rgba(28,61,46,.15)"}"></div>' for i in range(3)) + '</div>'
    b += f'<div class="sub">{c.L("Step 1 of 3 · Your stores","الخطوة 1 من 3 · فروعك")}</div>'
    stores = [(c.L("Zamalek","الزمالك"), c.L("Cairo, Egypt","القاهرة، مصر")),(c.L("New Cairo","القاهرة الجديدة"), c.L("Cairo, Egypt","القاهرة، مصر"))]
    for i,(n,city) in enumerate(stores):
        b += f'<div class="card" {c.st(c.a("fadeUp",.5,.5+i*.5))}><div class="tick"><div class="fill" style="opacity:1">{ic("check")}</div></div><div class="grow"><div class="t">{n}</div><div class="s">{city}</div></div></div>'
    b += f'''<div class="card" style="flex-direction:column;align-items:stretch;border-color:var(--green)" {c.st(c.a("fadeUp",.5,1.6))}>
<div class="s" style="margin:0 0 8px">{c.L("Store name","اسم الفرع")}</div><div class="t" style="border-bottom:2px solid var(--line);padding-bottom:10px;min-height:44px">{typer(c,c.L("Sheikh Zayed","الشيخ زايد"),2.0,1.0)}</div>
<div class="s" style="margin:16px 0 8px">{c.L("City","المدينة")}</div><div class="t" style="border-bottom:2px solid var(--green);padding-bottom:10px;min-height:44px">{typer(c,c.L("Sheikh","الشيخ"),3.2,.6)}</div>
<div style="margin-top:10px;border:2px solid var(--line);border-radius:12px;overflow:hidden" {c.st(c.a("fadeUp",.35,3.9))}>
<div style="padding:16px 18px;font-size:24px;font-weight:600;background:var(--green-tint)" {c.st(c.a("hl",.3,4.5,"linear"))}>{c.L("Sheikh Zayed City, Giza","مدينة الشيخ زايد، الجيزة")}</div>
<div style="padding:16px 18px;font-size:24px;color:var(--ink-soft)">{c.L("Sheikh Zuweid, North Sinai","الشيخ زويد، شمال سيناء")}</div></div></div>'''
    b += f'<div class="btn ghost" style="display:flex;gap:12px;justify-content:center;align-items:center" {c.st(c.a("fadeUp",.5,2.3))}>{ic("plus")} {c.L("Add store","إضافة فرع")}</div>'
    return phone(c, c.L("Set up your business","إعداد منشأتك"), "", b, tabs=False) + tapdot(c, 540, 1060, 4.5)

def scr_roles(c):
    roles = [(c.L("Business Owner","مالك المنشأة"), c.L("Full access: billing, users, every checklist","صلاحية كاملة: الفواتير والمستخدمون وكل القوائم")),
             (c.L("Operations Manager","مدير العمليات"), c.L("Checklists, users and stores business-wide","القوائم والمستخدمون والفروع على مستوى المنشأة")),
             (c.L("Area Manager","مدير المنطقة"), c.L("A group of branches and their staff","مجموعة فروع وموظفوها")),
             (c.L("Store Manager","مدير الفرع"), c.L("Day-to-day compliance for one branch","الالتزام اليومي لفرع واحد")),
             (c.L("Employee","موظف"), c.L("Completes assigned checklists and reports","ينجز القوائم والتقارير المسندة إليه"))]
    b = f'<div class="sub">{c.L("Step 2 of 3 · Roles","الخطوة 2 من 3 · الأدوار")}</div>'
    step = max(.9, (c.D-2.2)/5)
    for i,(n,d) in enumerate(roles):
        o = .4 + i*step
        b += f'<div class="card" {c.st(c.a("fadeUp",.45,.3+i*.15), c.a("hl",.35,o,"linear","forwards"))}>{tickbox(c,o+.1)}<div class="grow"><div class="t">{n}</div><div class="s">{d}</div></div></div>'
    return phone(c, c.L("Set up your business","إعداد منشأتك"), "", b, tabs=False)

def scr_invite(c):
    b = f'<div class="sub">{c.L("Step 3 of 3 · Invite your team","الخطوة 3 من 3 · دعوة الفريق")}</div>'
    b += f'<div class="card" style="flex-direction:column;align-items:stretch" {c.st(c.a("fadeUp",.5,.3))}><div class="s">{c.L("Name","الاسم")}</div><div class="t" style="min-height:40px">{typer(c,c.L("Mona Adel","منى عادل"),.6,.7)}</div><div class="s" style="margin-top:12px">{c.L("Role","الدور")}</div><div class="t">{c.L("Store Manager · Zamalek","مدير الفرع · الزمالك")}</div></div>'
    b += f'<div class="btn" style="display:flex;gap:12px;justify-content:center;align-items:center" {c.st(c.a("fadeUp",.5,.5))}>{ic("link")} {c.L("Create invite link","إنشاء رابط دعوة")}</div>'
    b += f'<div class="card" style="margin-top:16px;border-style:dashed;border-color:var(--green)" {c.st(c.a("pop",.45,1.7))}><div class="grow mono" style="font-size:24px;color:var(--green)">…/invite/7F3K-Q9</div><span class="pill p-green" {c.st(c.a("fadeIn",.2,2.4))}>{c.L("Copied","تم النسخ")} ✓</span></div>'
    b += f'<div class="sub" style="margin-top:24px" {c.st(c.a("fadeIn",.4,2.6))}>{c.L("Team","الفريق")}</div>'
    for i,(n,r) in enumerate([(c.L("Mona Adel","منى عادل"),c.L("Store Manager","مدير الفرع")),(c.L("Karim Hassan","كريم حسن"),c.L("Employee","موظف")),(c.L("Sara Nabil","سارة نبيل"),c.L("Employee","موظف"))]):
        b += f'<div class="card" {c.st(c.a("fadeUp",.45,2.8+i*.35))}><div style="width:54px;height:54px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;font-weight:700;font-size:24px">{n[0]}</div><div class="grow"><div class="t">{n}</div><div class="s">{r}</div></div><span class="pill p-green">{c.L("Joined","انضم")}</span></div>'
    return phone(c, c.L("Team & stores","الفريق والفروع"), "", b, tabs=False) + tapdot(c, 540, 845, 1.4)

def scr_pricing(c):
    def qty(label, frm, to, off, rate_from, rate_to):
        return f'''<div class="card" style="flex-direction:column;align-items:stretch" {c.st(c.a("fadeUp",.5,off))}>
<div class="t">{label}</div>
<div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px">
<div style="width:64px;height:64px;border-radius:14px;border:2.5px solid var(--line);display:grid;place-items:center;font-size:28px">{ic("minus")}</div>
<div style="font-size:64px;font-weight:700">{counter(c,frm,to,off+.5,2.2)}</div>
<div style="width:64px;height:64px;border-radius:14px;background:var(--green);color:#fff;display:grid;place-items:center;font-size:28px">{ic("plus")}</div></div>
<div class="s" style="margin-top:12px;display:flex;justify-content:space-between"><span>{c.L("Avg. rate per unit","متوسط السعر للوحدة")}</span><b class="mono" style="color:var(--green);font-size:26px">${counter(c,rate_from,rate_to,off+.5,2.2,"",2)}</b></div></div>'''
    b = f'<div class="sub">{c.L("Configure your plan","اضبط خطتك")}</div>'
    b += qty(c.L("Branches","الفروع"),1,5,.3,10.00,9.33)
    b += qty(c.L("Users","المستخدمون"),1,20,.7,10.00,7.50)
    # tapering chart
    pts = ' '.join(f"{20+i*28},{30+ (min(i,9)/9)*90:.1f}" for i in range(20))
    b += f'''<div class="card" style="flex-direction:column;align-items:stretch" {c.st(c.a("fadeUp",.5,2.9))}>
<div class="s">{c.L("Your rate drops as you grow","سعرك يقل كلما كبرت")}</div>
<svg viewBox="0 0 560 150" style="width:100%;height:150px;margin-top:6px;{'transform:scaleX(-1)' if c.lang=='ar' else ''}"><polyline points="{pts}" fill="none" stroke="var(--ok)" stroke-width="6" stroke-linecap="round" stroke-dasharray="700" style="--c:700;--o:0;stroke-dashoffset:700;animation:{c.a("ring",1.4,3.2)}"/></svg>
<div style="display:flex;justify-content:space-between;font-size:20px;color:var(--ink-soft)" class="mono"><span>$10</span><span>→</span><span>$7 / $5</span></div></div>'''
    b += f'<div class="btn" {c.st(c.a("fadeUp",.5,3.6))}>{c.L("Continue to checkout","متابعة الدفع")}</div>'
    return phone(c, c.L("Pricing","الأسعار"), "", b, tabs=False)

EQUIP = lambda c: [(c.L("Walk-in chiller","غرفة التبريد"),"0–5°C"),(c.L("Freezer","المجمّد"),"≤ −18°C"),(c.L("Hot holding","الحفظ الساخن"),"≥ 63°C"),(c.L("Prep fridge","ثلاجة التحضير"),"0–5°C")]
def temp_table(c, vals, base, step, red=None):
    h = f'<table class="tl"><tr><th>{c.L("Equipment","المعدّة")}</th><th>{c.L("Start","بداية")}</th><th>{c.L("Mid","منتصف")}</th><th>{c.L("End","نهاية")}</th></tr>'
    k = 0
    for r,(n,rng) in enumerate(EQUIP(c)):
        h += f'<tr><td>{n}<small class="mono">{rng}</small></td>'
        for col in range(3):
            v = vals[r][col]
            if v is None: h += '<td></td>'; continue
            is_red = red == (r,col)
            o = base + k*step; k += 1
            anim = [c.a("pop",.35,o)]
            if is_red: anim.append(c.a("shake",.5,o+.35,"ease-in-out"))
            h += f'<td><div class="cell {"r" if is_red else "g"} mono" {c.st(*anim)}>{v}°</div></td>'
        h += '</tr>'
    return h + '</table>'

def scr_temps(c):
    vals = [["3","4","3"],["−19","−20","−19"],["68","66","65"],["2","4","3"]]
    b = f'<div class="sub">{c.L("Temperature log","سجل درجات الحرارة")}</div>' + temp_table(c, vals, .7, max(.25,(c.D-1.8)/12))
    b += f'<div class="banner b-green" style="margin-top:14px" {c.st(c.a("fadeUp",.5,c.D-1.1))}>{ic("check")}<div>{c.L("All readings in safe range","كل القراءات في النطاق الآمن")}</div></div>'
    return phone(c, c.L("Kitchen daily report","تقرير المطبخ اليومي"), "KDR-001", b)

def scr_tempalert(c):
    vals = [["3","8",None],["−19",None,None],["68",None,None],["2",None,None]]
    b = f'<div class="sub">{c.L("Temperature log","سجل درجات الحرارة")}</div>'
    h = f'<table class="tl"><tr><th>{c.L("Equipment","المعدّة")}</th><th>{c.L("Start","بداية")}</th><th>{c.L("Mid","منتصف")}</th><th>{c.L("End","نهاية")}</th></tr>'
    for r,(n,rng) in enumerate(EQUIP(c)):
        h += f'<tr><td>{n}<small class="mono">{rng}</small></td>'
        for col in range(3):
            v = vals[r][col]
            if v is None: h += '<td></td>'; continue
            if (r,col)==(0,1):
                h += f'<td><div class="cell r mono" {c.st(c.a("pop",.4,1.0), c.a("shake",.6,1.4,"ease-in-out"))}>8°</div></td>'
            else:
                h += f'<td><div class="cell g mono" style="opacity:1">{v}°</div></td>'
        h += '</tr>'
    b += h + '</table>'
    b += f'<div class="banner b-red" style="margin-top:14px" {c.st(c.a("fadeUp",.5,1.7))}>{ic("alert")}<div>{c.L("Out of safe range: Walk-in chiller 8°C","خارج النطاق الآمن: غرفة التبريد 8°م")}<div style="font-size:20px;opacity:.9;margin-top:6px">{c.L("Manager notified · corrective action required","تم إبلاغ المدير · مطلوب إجراء تصحيحي")}</div></div></div>'
    return phone(c, c.L("Kitchen daily report","تقرير المطبخ اليومي"), "KDR-001", b) + tapdot(c, 590, 815, .9)

def scr_checklist(c):
    items = [c.L("Handwashing stations stocked","محطات غسل اليدين مجهزة"),c.L("Uniforms & hair restraints checked","فحص الزي وغطاء الشعر"),
             c.L("FIFO labels on all prepped food","ملصقات FIFO على كل المحضّرات"),c.L("Sanitizer buckets at correct strength","تركيز المعقم صحيح"),
             c.L("Line & pass cleaned","تنظيف الخط ومنطقة التسليم")]
    step = max(.45,(c.D-2.6)/len(items))
    b = f'<div class="sub">{c.L("Opening checklist","قائمة الافتتاح")}</div>'
    b += f'<div class="bar" style="margin:0 4px 18px"><i {c.st(c.a("scaleX",step*len(items),.6,"linear"))}></i></div>'
    for i,t in enumerate(items):
        b += f'<div class="card" style="padding:16px 20px" {c.st(c.a("fadeUp",.4,.2+i*.1))}>{tickbox(c,.6+(i+1)*step-.15)}<div class="grow t" style="font-size:25px">{t}</div></div>'
    so = .6+len(items)*step+.1
    b += f'<div class="btn" {c.st(c.a("fadeUp",.4,.3))}>{c.L("Sign off","اعتماد")}</div>'
    b += f'<div class="banner b-green" style="margin-top:12px" {c.st(c.a("pop",.4,so+.3))}>{ic("check")}<div>{c.L("Signed by shift lead · 08:42","اعتمده قائد الوردية · 08:42")}</div></div>'
    return phone(c, c.L("Daily opening report","تقرير الافتتاح اليومي"), "KDR-001", b) + tapdot(c, 540, 1105, so)

def scr_waste(c):
    rows = [(c.L("Chicken breast","صدور دجاج"),"1.2 kg",c.L("Expired","منتهي الصلاحية"),"p-red"),
            (c.L("Bread rolls","خبز صغير"),"14 pcs",c.L("Over-production","إنتاج زائد"),"p-amber"),
            (c.L("Salmon fillet","فيليه سلمون"),"0.4 kg",c.L("Prep error","خطأ تحضير"),"p-amber")]
    b = f'<div class="sub">{c.L("Waste log","سجل الهالك")}</div>'
    for i,(n,q,r,pc) in enumerate(rows):
        b += f'<div class="card" {c.st(c.a("fadeUp",.45,.5+i*.8))}><div class="grow"><div class="t">{n}</div><div class="s mono">{q}</div></div><span class="pill {pc}">{r}</span></div>'
    b += f'<div class="btn ghost" style="display:flex;gap:12px;justify-content:center;align-items:center" {c.st(c.a("fadeUp",.4,.3))}>{ic("plus")} {c.L("Add waste entry","إضافة هالك")}</div>'
    b += f'<div class="card" style="margin-top:16px;background:var(--amber-tint);border-color:var(--amber)" {c.st(c.a("fadeUp",.5,3.0))}><div class="grow"><div class="t" style="color:var(--amber-text)">{c.L("Top reason this week: Expired","السبب الأكثر هذا الأسبوع: انتهاء الصلاحية")}</div><div class="s">{c.L("Tighten FIFO rotation","شدّد تطبيق FIFO")}</div></div></div>'
    return phone(c, c.L("Kitchen daily report","تقرير المطبخ اليومي"), "KDR-001", b) + tapdot(c, 540, 1010, .45)

def sub_html(s):
    return f'<div class="s mono">{s}</div>' if s else ''

def scr_bar(c):
    items = [(c.L("Beer cooler","ثلاجة المشروبات"),"2°C · 1–4°C"),(c.L("Wine fridge","ثلاجة النبيذ"),"10°C · 8–12°C"),
             (c.L("Ice machine cleaned","تنظيف ماكينة الثلج"),""),(c.L("Syrups & juices dated","تأريخ العصائر والشراب"),""),
             (c.L("Allergen info at station","معلومات مسببات الحساسية متاحة"),"")]
    step = max(.45,(c.D-2)/len(items))
    b = f'<div class="sub">{c.L("Bar opening checks","فحوصات افتتاح البار")}</div>'
    for i,(t,s) in enumerate(items):
        b += f'<div class="card" style="padding:16px 20px" {c.st(c.a("fadeUp",.4,.2+i*.12))}>{tickbox(c,.6+i*step)}<div class="grow"><div class="t" style="font-size:25px">{t}</div>{sub_html(s)}</div></div>'
    return phone(c, c.L("Bar & beverage report","تقرير البار والمشروبات"), "BDR-001", b)

QC_SECTIONS = lambda c: [c.L("A · Exterior & entrance","أ · الواجهة والمدخل"),c.L("B · Dining area","ب · صالة الطعام"),c.L("C · Food safety & hygiene","ج · سلامة الغذاء والنظافة"),
    c.L("D · Temperature control","د · التحكم في الحرارة"),c.L("E · Storage & FIFO","هـ · التخزين وFIFO"),c.L("F · Staff grooming","و · مظهر الموظفين"),c.L("G · Service standards","ز · معايير الخدمة")]
def scr_qc(c):
    b = f'<div class="card" style="justify-content:space-between" {c.st(c.a("fadeUp",.5,.3))}><div><div class="t" style="font-size:44px">{counter(c,0,104,.5,1.4)}</div><div class="s">{c.L("scored points","نقطة تقييم")}</div></div><div><div class="t" style="font-size:44px">12</div><div class="s">{c.L("sections","قسم")}</div></div><div><div class="t mono" style="font-size:36px;color:var(--green)">≥95%</div><div class="s">{c.L("target","المستهدف")}</div></div></div>'
    for i,s in enumerate(QC_SECTIONS(c)):
        o = .9+i*.35
        b += f'<div class="card" style="padding:16px 22px" {c.st(c.a("fadeUp",.4,o))}><div class="grow t" style="font-size:25px">{s}</div><span class="mono" style="font-size:22px;color:var(--ink-soft)">▾</span></div>'
    return phone(c, c.L("QC visit report","تقرير زيارة الجودة"), "QC-D-001", b)

def qc_item(c, text, off, issue=False, crit=False):
    okc = 'var(--ok)'; isc = 'var(--red)'
    sel_ok = '' if issue else f'{c.st(c.a("hl",.25,off,"linear","forwards"))}'
    sel_is = f'{c.st(c.a("hl",.25,off,"linear","forwards"))}' if issue else ''
    critb = f'<span class="pill p-red" style="font-size:17px;margin-inline-start:8px">⚠ {c.L("critical","حرج")}</span>' if crit else ''
    return f'''<div class="card" style="flex-direction:column;align-items:stretch;padding:16px 20px">
<div class="t" style="font-size:24px">{text}{critb}</div>
<div style="display:flex;gap:12px;margin-top:12px">
<div style="flex:1;text-align:center;border:2.5px solid var(--line);border-radius:12px;padding:10px;font-size:22px;font-weight:700;color:{okc};background:#fff" {sel_ok}>{c.L("OK","سليم")}</div>
<div style="flex:1;text-align:center;border:2.5px solid var(--line);border-radius:12px;padding:10px;font-size:22px;font-weight:700;color:{isc};background:#fff" {sel_is}>{c.L("Issue","مشكلة")}</div></div></div>'''

def scr_score(c):
    b = f'<div class="card" style="gap:24px" {c.st(c.a("fadeUp",.5,.2))}>{ring(c,96,"var(--ok)",.6,size=140,dur=c.D-1.6)}<div class="grow"><div class="t">{c.L("C · Food safety & hygiene","ج · سلامة الغذاء والنظافة")}</div><div class="s">{c.L("Live section score","درجة القسم لحظيًا")}</div><span class="pill p-green" style="display:inline-block;margin-top:10px" {c.st(c.a("pop",.4,c.D-.9))}>{c.L("GREEN","أخضر")}</span></div></div>'
    its = [c.L("Hand sinks stocked with soap & towels","أحواض اليدين مزودة بالصابون والمناديل"),c.L("Cutting boards color-coded","ألواح التقطيع مميزة بالألوان"),c.L("Food contact surfaces sanitized","أسطح ملامسة الطعام معقمة")]
    for i,t in enumerate(its):
        b += qc_item(c, t, .8+i*.8)
    return phone(c, c.L("QC visit report","تقرير زيارة الجودة"), "QC-D-001", b) + tapdot(c, 390 if c.lang=='en' else 690, 700, .8) + tapdot(c, 390 if c.lang=='en' else 690, 890, 1.6)

def scr_critical(c):
    b = f'<div class="card" style="gap:24px" {c.st(c.a("fadeUp",.3,0))}>{ring(c,96,"var(--ok)",-2,size=140,dur=.1,red_at=1.0)}<div class="grow"><div class="t">{c.L("C · Food safety & hygiene","ج · سلامة الغذاء والنظافة")}</div><div class="s">{c.L("Live section score","درجة القسم لحظيًا")}</div><span class="pill p-red" style="display:inline-block;margin-top:10px" {c.st(c.a("pop",.4,1.1))}>{c.L("RED · critical fail","أحمر · مخالفة حرجة")}</span></div></div>'
    b += qc_item(c, c.L("Raw & cooked food stored separately","فصل الطعام النيء عن المطبوخ"), .8, issue=True, crit=True)
    b += f'<div class="banner b-red" style="margin-top:6px" {c.st(c.a("fadeUp",.5,1.5), c.a("shake",.5,2.0,"ease-in-out"))}>{ic("alert")}<div>{c.L("Critical fail — incident flagged","مخالفة حرجة — تم تسجيل حادثة")}<div style="font-size:20px;opacity:.9;margin-top:6px">{c.L("Store & area manager alerted","تم تنبيه مدير الفرع ومدير المنطقة")}</div></div></div>'
    return phone(c, c.L("QC visit report","تقرير زيارة الجودة"), "QC-D-001", b) + tapdot(c, 690 if c.lang=='en' else 390, 740, .8)

def viewfinder(c, inner, flash_at=None):
    fl = f'<div style="position:absolute;inset:0;background:#fff;opacity:0;animation:{c.a("flash",.6,flash_at,"ease-out")}"></div>' if flash_at is not None else ''
    return f'''<div style="position:relative;height:640px;border-radius:22px;overflow:hidden;background:linear-gradient(160deg,#9aa4a0 0%,#cfd5d2 35%,#b8bfbb 60%,#7f8985 100%)">
<div style="position:absolute;left:8%;right:8%;top:52%;height:34%;background:linear-gradient(180deg,#e9ecea,#c3c9c6);border-radius:10px;transform:perspective(600px) rotateX(38deg);box-shadow:0 20px 30px rgba(0,0,0,.2)"></div>
<div style="position:absolute;left:20%;top:30%;width:22%;height:20%;background:#f5f5f2;border-radius:50%;opacity:.8"></div>
<div style="position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 33.2%,rgba(255,255,255,.35) 33.2% 33.5%),repeating-linear-gradient(0deg,transparent 0 33.2%,rgba(255,255,255,.35) 33.2% 33.5%)"></div>
{inner}{fl}</div>'''

def scr_camera(c):
    b = f'<div class="card" style="padding:16px 20px" {c.st(c.a("fadeUp",.4,.2))}><div class="grow t" style="font-size:24px">{c.L("Prep surface sanitized","تعقيم سطح التحضير")}</div><span class="pill p-amber">{c.L("Photo required","صورة مطلوبة")}</span></div>'
    b += f'<div {c.st(c.a("fadeUp",.5,.6))}>' + viewfinder(c, f'<div style="position:absolute;top:18px;inset-inline-start:18px;background:rgba(0,0,0,.55);color:#fff;font-size:20px;padding:6px 12px;border-radius:8px;display:flex;gap:8px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#e04b3a"></span>{c.L("LIVE","مباشر")}</div>', flash_at=2.6) + '</div>'
    b += f'<div style="display:flex;justify-content:center;margin-top:26px" {c.st(c.a("fadeUp",.5,.9))}><div style="width:120px;height:120px;border-radius:50%;border:8px solid var(--green);display:grid;place-items:center"><div style="width:86px;height:86px;border-radius:50%;background:var(--green)"></div></div></div>'
    return phone(c, c.L("Camera","الكاميرا"), "", b, tabs=False) + tapdot(c, 540, 1225, 2.45)

def scr_stamp(c):
    stampv = f'''<div style="position:absolute;left:14px;right:14px;bottom:14px;background:rgba(18,39,29,.85);color:#fff;border-radius:12px;padding:14px 16px;font-size:21px;line-height:1.6" {c.st(c.a("fadeUp",.5,.8))}>
<div style="display:flex;gap:10px;align-items:center">{ic("clock")}<span class="mono">27 Sep 2026 · 08:42:17</span></div>
<div style="display:flex;gap:10px;align-items:center" {c.st(c.a("fadeUp",.5,1.4))}>{ic("pin")}<span class="mono">30.0626° N, 31.2197° E</span></div></div>'''
    b = f'<div {c.st(c.a("fadeIn",.3,0))}>' + viewfinder(c, stampv).replace('height:640px','height:560px') + '</div>'
    b += f'<div class="card" style="margin-top:18px;border-color:var(--ok)" {c.st(c.a("fadeUp",.5,2.2))}><div class="tick"><div class="fill" style="opacity:1">{ic("check")}</div></div><div class="grow"><div class="t" style="font-size:25px">{c.L("Prep surface sanitized","تعقيم سطح التحضير")}</div><div class="s" style="display:flex;gap:8px;align-items:center">{ic("camera")} {c.L("1 photo attached","صورة واحدة مرفقة")}</div></div></div>'
    return phone(c, c.L("Opening checklist","قائمة الافتتاح"), "SOP-1", b, tabs=False)

def scr_nogallery(c):
    b = f'<div {c.st(c.a("fadeIn",.3,0))}>' + viewfinder(c, '').replace('height:640px','height:420px') + '</div>'
    b += f'''<div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:34px 34px 0 0;padding:34px 30px 50px;box-shadow:0 -10px 30px rgba(0,0,0,.15)" {c.st(c.a("fadeUp",.5,.4))}>
<div class="card" style="border-color:var(--green)"><span style="font-size:40px;color:var(--green)">{ic("camera")}</span><div class="grow t">{c.L("Take live photo","التقاط صورة حية")}</div><span class="pill p-green">✓</span></div>
<div class="card" style="position:relative;opacity:.55"><span style="font-size:40px;color:var(--ink-soft)">{ic("img")}</span><div class="grow t" style="position:relative">{c.L("Upload from gallery","رفع من المعرض")}<i style="position:absolute;left:0;right:0;top:52%;height:4px;background:var(--red);transform-origin:{'right' if c.lang=='ar' else 'left'};animation:{c.a("strike",.4,1.3)}"></i></div><span style="font-size:36px;color:var(--red)">{ic("lock")}</span></div>
<div class="banner b-green" {c.st(c.a("pop",.45,2.0))}>{ic("check")}<div>{c.L("Camera only — every photo is real and current","الكاميرا فقط — كل صورة حقيقية وحديثة")}</div></div></div>'''
    return phone(c, c.L("Add evidence","إضافة دليل"), "", b, tabs=False)

def scr_kpi(c):
    br = [(c.L("Zamalek","الزمالك"),97,'var(--ok)'),(c.L("New Cairo","القاهرة الجديدة"),92,'var(--amber)'),(c.L("Sheikh Zayed","الشيخ زايد"),81,'var(--red)'),(c.L("Maadi","المعادي"),95,'var(--ok)')]
    b = f'<div class="sub">{c.L("Compliance by branch · this week","الالتزام حسب الفرع · هذا الأسبوع")}</div>'
    for i,(n,v,col) in enumerate(br):
        o = .5+i*.4
        pulse = f', {c.a("pulse",1.2,2.6,"ease-in-out","both"," infinite")}' if v<85 else ''
        b += f'''<div class="card" style="flex-direction:column;align-items:stretch;padding:18px 22px" {c.st(c.a("fadeUp",.45,o)+pulse)}>
<div style="display:flex;justify-content:space-between;align-items:center"><div class="t">{n}</div><b style="font-size:32px;color:{col}">{counter(c,0,v,o+.2,1.2,"%")}</b></div>
<div class="bar" style="margin-top:12px;height:20px;border-radius:10px"><i style="background:{col};--to:{v/100};animation:{c.a("scaleX",1.2,o+.2)}"></i></div></div>'''
    b += f'<div class="banner b-red" {c.st(c.a("fadeUp",.5,2.4))}>{ic("alert")}<div>{c.L("Sheikh Zayed: 2 critical fails — act here first","الشيخ زايد: مخالفتان حرجتان — ابدأ من هنا")}</div></div>'
    return phone(c, c.L("KPI dashboard","لوحة مؤشرات الأداء"), "", b)

LIB = lambda c: [("HACCP", c.L("Cooling: 60°C → 21°C within 2 h","التبريد: من 60 إلى 21°م خلال ساعتين"), True),
    ("ISO 22000", c.L("Supplier temperature checked on receiving","فحص حرارة المورد عند الاستلام"), False),
    ("INTERNAL_QC", c.L("Walk-in chiller 0–5°C","غرفة التبريد 0–5°م"), True),
    ("SOP", c.L("SOP 4 · Temperature monitoring log","إجراء 4 · سجل مراقبة الحرارة"), True),
    ("SOP", c.L("SOP 12 · Recipe card followed","إجراء 12 · الالتزام ببطاقة الوصفة"), False)]
def lib_row(c, std, text, crit, off, sel_at=None, hide_at=None):
    box = tickbox(c, sel_at) if sel_at is not None else '<div class="tick"></div>'
    anims = [c.a("fadeUp",.4,off)]
    if hide_at is not None: anims.append(c.a("collapse",.45,hide_at,"ease-in","forwards"))
    critb = f'<span class="pill p-red" style="font-size:16px">⚠</span>' if crit else ''
    return f'<div class="card" style="padding:14px 18px" {c.st(*anims)}>{box}<div class="grow"><div class="s mono" style="margin:0 0 4px;font-size:18px;color:var(--green)">{std}</div><div class="t" style="font-size:23px">{text}</div></div>{critb}</div>'

def builder_head(c, off_type, crit_on=None):
    chips = ''.join(f'<span class="pill p-green mono" style="font-size:17px">{s}</span>' for s in ["HACCP","ISO 22000","INTERNAL_QC","SOP"])
    crit = f'<div style="display:flex;align-items:center;justify-content:space-between;margin:14px 4px 6px"><span class="t" style="font-size:24px">{c.L("Critical only","الحرجة فقط")}</span><div style="width:76px;height:42px;border-radius:21px;background:{"var(--line)"};position:relative" {c.st(c.a("hl",.01,crit_on,"linear","forwards"))  if False else ""}><div style="position:absolute;inset:0;border-radius:21px;background:var(--red);opacity:0;{"animation:"+c.a("fadeIn",.25,crit_on) if crit_on is not None else ""}"></div><div style="position:absolute;top:4px;inset-inline-start:4px;width:34px;height:34px;border-radius:50%;background:#fff;{"animation:"+c.a("slideTog",.25,crit_on) if crit_on is not None else ""}"></div></div></div>'
    return f'''<div class="card" style="padding:14px 18px" {c.st(c.a("fadeUp",.4,.2))}><span style="font-size:30px;color:var(--ink-soft)">{ic("search")}</span><div class="grow t" style="font-size:25px;min-height:34px">{typer(c,c.L("temperature","الحرارة"),off_type,.8) if off_type is not None else c.L("temperature","الحرارة")}</div></div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 2px 4px" {c.st(c.a("fadeUp",.4,.4))}>{chips}</div>{crit}'''

def scr_builder(c):
    b = f'<div class="sub" style="display:flex;justify-content:space-between"><span>{c.L("Master library","المكتبة الرئيسية")}</span><span>{counter(c,0,379,.3,1.4)} {c.L("items","بندًا")}</span></div>'
    b += builder_head(c, 1.4)
    for i,(s,t,cr) in enumerate(LIB(c)):
        b += lib_row(c, s, t, cr, 2.3+i*.35)
    return phone(c, c.L("Checklist builder","منشئ قوائم الفحص"), "", b, tabs=False)

def scr_builderselect(c):
    b = f'<div class="sub" style="display:flex;justify-content:space-between"><span>{c.L("Master library","المكتبة الرئيسية")}</span><span>379 {c.L("items","بندًا")}</span></div>'
    b += builder_head(c, None, crit_on=.6)
    lib = LIB(c)
    for i,(s,t,cr) in enumerate(lib):
        if cr: b += lib_row(c, s, t, cr, 0, sel_at=2.0+i*.12)
        else: b += lib_row(c, s, t, cr, 0, hide_at=.9)
    b += f'<div class="btn ghost" style="margin-top:4px" {c.st(c.a("fadeUp",.3,0))}>{c.L("Select all shown","تحديد كل المعروض")}</div>'
    b += f'<div class="banner b-green" style="margin-top:12px" {c.st(c.a("pop",.45,3.4))}>{ic("check")}<div>{c.L("Assigned: Zamalek · daily","تم التعيين: الزمالك · يوميًا")}</div></div>'
    return phone(c, c.L("Checklist builder","منشئ قوائم الفحص"), "", b, tabs=False) + tapdot(c, 760 if c.lang=='en' else 320, 668, .5) + tapdot(c, 540, 1140, 1.8)

def scr_reports(c):
    reps = [(c.L("QC visit · Zamalek","زيارة جودة · الزمالك"),"QC-D-001",c.L("GREEN 97%","أخضر 97%"),"p-green"),
            (c.L("Kitchen daily · New Cairo","المطبخ اليومي · القاهرة الجديدة"),"KDR-001",c.L("AMBER 91%","برتقالي 91%"),"p-amber"),
            (c.L("Bar & beverage · Maadi","البار · المعادي"),"BDR-001",c.L("GREEN 96%","أخضر 96%"),"p-green"),
            (c.L("Area manager visit","زيارة مدير المنطقة"),"AMV",c.L("GREEN 95%","أخضر 95%"),"p-green")]
    b = f'<div class="sub">{c.L("Reports","التقارير")}</div>'
    for i,(n,code,s,pc) in enumerate(reps):
        b += f'<div class="card" {c.st(c.a("fadeUp",.45,.3+i*.3))}><div class="grow"><div class="t" style="font-size:25px">{n}</div><div class="s mono">{code}</div></div><span class="pill {pc}">{s}</span></div>'
    b += f'<div class="btn" style="display:flex;gap:12px;justify-content:center;align-items:center" {c.st(c.a("fadeUp",.45,1.6))}>{ic("share")} {c.L("Share report","مشاركة التقرير")}</div>'
    b += f'<div class="banner b-green" style="margin-top:14px" {c.st(c.a("pop",.45,2.6))}>{ic("link")}<div>{c.L("Link copied — send it to your partner","تم نسخ الرابط — أرسله لشريكك")}</div></div>'
    return phone(c, c.L("Reports","التقارير"), "", b) + tapdot(c, 540, 1065, 2.4)

SCREENS = {k[4:]: v for k, v in globals().items() if k.startswith('scr_')}

# ---------------------------------------------------------------- big scenes
def sc_hook(c, p, v):
    big = p['big_ar'] if c.lang=='ar' else p['big_en']
    lines = big.split('\n')
    h = ''.join(f'<span style="display:block;animation:{c.a("fadeUp",.6,.15+i*.35)}">{html.escape(l)}</span>' for i,l in enumerate(lines))
    return f'<div class="hook"><div class="k" style="animation:{c.a("fadeIn",.5,0)}">{"SOPY OVERVIEW" if v["tag"]=="00" else "TUTORIAL "+v["tag"]}</div><h1>{h}</h1><div class="ul" style="animation:{c.a("scaleX",.6,.8)}"></div></div>'

def sc_binder(c, p, v):
    out = ''
    specs = [(-180,-60,-8,-24,c.L("LOST","ضاع")),(40,-120,6,30,c.L("SKIPPED","أُهمل")),(-60,160,-3,-40,c.L("NOT CHECKED","لم يُراجع"))]
    for i,(x,y,r0,r1,lab) in enumerate(specs):
        o = .1+i*.25
        out += f'<div class="paper" style="left:calc(50% + {x}px - 150px);top:calc(50% + {y}px - 195px);--r0:{r0}deg;--r1:{r1}deg;--dx:{x*1.2}px;animation:{c.a("floatIn",.6,o)}, {c.a("fall",1.1,c.D-1.3,"cubic-bezier(.5,0,.9,.5)","forwards")}">' + '<i style="width:70%"></i>' + '<i></i>'*6 + f'<div class="stamp" style="top:130px;left:20px;transform:rotate(-10deg);animation:{c.a("pop",.35,.9+i*.55)}">{lab}</div></div>'
    return f'<div style="position:relative;width:100%;height:100%">{out}</div>'

def sc_bullets(c, p, v):
    items = p['items_ar'] if c.lang=='ar' else p['items_en']
    step = max(.5, (c.D-1.5)/len(items))
    rows = ''.join(f'<div class="row" style="animation:{c.a("fadeUp",.5,.2+i*step)}"><div class="dot" style="animation:{c.a("pop",.5,.3+i*step)}">{ic("check")}</div>{html.escape(t)}</div>' for i,t in enumerate(items))
    return f'<div class="bul">{rows}</div>'

def sc_thresholds(c, p, v):
    rows = [("var(--ok)",c.L("GREEN","أخضر"),"≥ 95%"),("var(--amber)",c.L("AMBER","برتقالي"),"85–94%"),("var(--red)",c.L("RED","أحمر"),"< 85%")]
    step = max(.9,(c.D-1)/3)
    h = ''.join(f'<div class="r" style="background:{col};animation:{c.a("fadeUp",.5,.2+i*step)}"><b>{n}</b><span>{r}</span></div>' for i,(col,n,r) in enumerate(rows))
    note = f'<div style="font-size:40px;font-weight:600;color:var(--red);margin-top:20px;display:flex;gap:16px;align-items:center;animation:{c.a("fadeUp",.5,.2+3*step-.4)}">{ic("alert")} {c.L("Any critical fail = RED","أي مخالفة حرجة = أحمر")}</div>' if c.D>3.2+3*0 else ''
    return f'<div class="thr">{h}{note}</div>'

def sc_cta(c, p, v):
    return f'''<div class="cta"><div class="logo" style="animation:{c.a("pop",.7,.1)}"><div class="mark">{ic("check")}</div>SOPY</div>
<h2 style="animation:{c.a("fadeUp",.6,.6)}">{c.L("Your SOP manual, on every shift.","دليل إجراءات التشغيل معك في كل وردية.")}</h2>
<p style="animation:{c.a("fadeUp",.6,.9)}">{c.L("For restaurants and cafés","للمطاعم والمقاهي")}</p>
<div class="btn" style="animation:{c.a("pop",.6,1.3)}">{c.L("Get started","ابدأ الآن")}</div></div>'''

BIG = {'hook': sc_hook, 'binder': sc_binder, 'bullets': sc_bullets, 'thresholds': sc_thresholds, 'cta': sc_cta}

JS = r"""
function ease(p){return 1-Math.pow(1-p,3)}
window.seek=function(t){
  document.getAnimations().forEach(a=>{a.pause();a.currentTime=t*1000;});
  document.querySelectorAll('.cnt').forEach(e=>{const s=+e.dataset.start,d=+e.dataset.dur,f=+e.dataset.from,to=+e.dataset.to,dec=+e.dataset.dec;
    let p=Math.min(1,Math.max(0,(t-s)/d));const v=f+(to-f)*ease(p);e.textContent=v.toFixed(dec)+e.dataset.suf;});
  document.querySelectorAll('.typ').forEach(e=>{const s=+e.dataset.start,d=+e.dataset.dur,tx=e.dataset.text;
    let p=Math.min(1,Math.max(0,(t-s)/d));const n=Math.round(tx.length*p);e.textContent=tx.slice(0,n)+((p>0&&p<1)?'|':'');});
};
"""

def build(v, lang, audio_durs):
    # timeline
    scenes = []; t = 0.0
    for i,(tpl,p,en,ar) in enumerate(v['scenes']):
        D = max(MIN_SCENE, audio_durs[i] + LEAD + GAP)
        if i == len(v['scenes'])-1: D += END_HOLD
        scenes.append((t, D)); t += D
    total = t
    body = ''
    for i,((tpl,p,en,ar),(S,D)) in enumerate(zip(v['scenes'], scenes)):
        c = Ctx(lang, S, D)
        if tpl.startswith('phone:'):
            inner = SCREENS[tpl[6:]](c)
        else:
            inner = BIG[tpl](c, p, v)
        cap = ''
        if tpl not in ('hook','cta'):
            txt = strip_ar(ar) if lang=='ar' else en
            cap = f'<div class="cap"><div style="animation:{c.a("fadeUp",.45,.15)}">{html.escape(txt)}</div></div>'
        out_at = S + D - .3 if i < len(v['scenes'])-1 else total + 5
        body += f'<div class="scene" style="animation:sIn .35s ease-out {S:.3f}s both, sOut .3s ease-in {out_at:.3f}s forwards"><div class="stage">{inner}</div>{cap}</div>\n'
    title = v['title_ar'] if lang=='ar' else v['title_en']
    head = f'''<div class="top"><div class="logo"><div class="mark">{ic("check")}</div>SOPY</div><div class="chip">{"OVERVIEW" if v["tag"]=="00" else "TUTORIAL "+v["tag"]+"/06"}</div></div>
<div class="eptitle">{html.escape(title)}</div><div class="prog"><i style="animation:scaleX {total:.3f}s linear 0s both"></i></div>'''
    page = f'''<!doctype html><html lang="{lang}" dir="{'rtl' if lang=='ar' else 'ltr'}"><head><meta charset="utf-8"><style>{FONT_CSS}{CSS}
@keyframes slideTog{{to{{transform:translateX({'-34px' if lang=='ar' else '34px'})}}}}</style></head>
<body class="{lang}"><div class="bg"></div>{head}{body}<script>{JS}</script></body></html>'''
    import re
    def merge(m):
        tag=m.group(0); styles=re.findall(r'style="([^"]*)"',tag)
        if len(styles)<2: return tag
        tag=re.sub(r'\s*style="[^"]*"','',tag)
        return tag[:-1].rstrip()+' style="'+';'.join(x.strip().rstrip(';') for x in styles)+'">'
    page=re.sub(r'<[a-zA-Z][^<>]*>',merge,page)
    os.makedirs('html', exist_ok=True)
    fn = f"html/{v['id']}_{lang}.html"
    open(fn,'w').write(page)
    return fn, total, [(S+LEAD) for S,_ in scenes]

if __name__ == '__main__':
    meta = {}
    for lang in ('en','ar'):
        tim = json.load(open(f'timing_{lang}.json'))
        for v in VIDEOS:
            fn, total, starts = build(v, lang, tim[v['id']])
            meta[f"{v['id']}_{lang}"] = {'html': fn, 'total': total, 'audio_starts': starts, 'n': len(v['scenes'])}
            print(fn, round(total,2))
    json.dump(meta, open('meta.json','w'), indent=1)
