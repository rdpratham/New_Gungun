"""
VISORA — Shorthills AI Sales Team Instagram Reel
1080x1920 @ 30fps, 60 seconds
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio
import imageio_ffmpeg
import math, random
from pathlib import Path
import os

# ═══════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════
W, H     = 1080, 1920
FPS      = 30
NAVY     = (10, 22, 40)
NAVY2    = (14, 32, 62)
GOLD     = (255, 200, 0)
GOLD2    = (255, 230, 100)
WHITE    = (255, 255, 255)
LGRAY    = (190, 205, 220)

def font(size, bold=True):
    paths = [
        f"/usr/share/fonts/truetype/liberation/LiberationSans-{'Bold' if bold else 'Regular'}.ttf",
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def ease_out(t, power=3):
    return 1 - (1 - min(1.0, max(0.0, t))) ** power

def lerp(a, b, t):
    return a + (b - a) * min(1.0, max(0.0, t))

def typewriter(text, t, cps=30):
    return text[:max(0, int(t * cps))]

# ═══════════════════════════════════════
# DRAWING HELPERS
# ═══════════════════════════════════════
def make_base():
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        t = y / H
        arr[y] = [int(10 + 8*t), int(22 + 12*t), int(40 + 20*t)]
    return Image.fromarray(arr)

def add_particles(img, count, seed, t, color=GOLD):
    random.seed(seed)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        px = random.randint(0, W)
        py = random.randint(0, H)
        spd = random.uniform(0.4, 1.4)
        offset = random.uniform(0, math.pi * 2)
        phase = (t * spd + offset) % (math.pi * 2)
        af = (math.sin(phase) + 1) / 2
        sz = random.randint(1, 4)
        a = int(af * random.randint(60, 180))
        r, g, b = color
        d.ellipse([px-sz, py-sz, px+sz, py+sz], fill=(r, g, b, a))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

def add_light_beams(img, t, cx=W//2, cy=int(H*0.35), alpha=25):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(8):
        angle = (i / 8) * math.pi * 2 + t * 0.25
        ex = int(cx + 1400 * math.cos(angle))
        ey = int(cy + 1400 * math.sin(angle))
        a_b = int(alpha * (0.4 + 0.6 * math.sin(t * 1.5 + i)))
        d.line([(cx, cy), (ex, ey)], fill=(255, 200, 50, a_b), width=3)
    blurred = layer.filter(ImageFilter.GaussianBlur(8))
    return Image.alpha_composite(img.convert("RGBA"), blurred).convert("RGB")

def centered_text(draw, text, y, fnt, color=WHITE):
    bb = draw.textbbox((0, 0), text, font=fnt)
    tw = bb[2] - bb[0]
    x = (W - tw) // 2
    draw.text((x+2, y+2), text, font=fnt, fill=(0, 0, 0, 100))
    draw.text((x, y), text, font=fnt, fill=color)

def gold_line(draw, y, width=300):
    draw.rectangle([(W//2 - width//2, y), (W//2 + width//2, y+3)], fill=GOLD)

def photo_circle(initials, size, photo_path=None):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if photo_path and Path(photo_path).exists():
        photo = Image.open(photo_path).convert("RGB")
        pw, ph = photo.size
        side = min(pw, ph)
        photo = photo.crop(((pw-side)//2, (ph-side)//2, (pw+side)//2, (ph+side)//2))
        photo = photo.resize((size, size), Image.LANCZOS)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size, size], fill=255)
        img.paste(photo, (0, 0), mask)
    else:
        for r in range(size//2, 0, -3):
            t_r = 1 - r / (size//2)
            col = (int(10+35*t_r), int(22+55*t_r), int(40+85*t_r), 220)
            d.ellipse([size//2-r, size//2-r, size//2+r, size//2+r], fill=col)
        fnt_i = font(int(size * 0.30), bold=True)
        bb = d.textbbox((0, 0), initials, font=fnt_i)
        iw, ih = bb[2]-bb[0], bb[3]-bb[1]
        d.text(((size-iw)//2, (size-ih)//2 - 8), initials, font=fnt_i, fill=(*GOLD, 230))
    # Gold ring
    for rr in range(5, 0, -1):
        d.ellipse([rr, rr, size-rr, size-rr], outline=(*GOLD, int(220*(1-rr/6))), width=2)
    return img

def blend(fa, fb, alpha):
    return (fa.astype(np.float32)*(1-alpha) + fb.astype(np.float32)*alpha).clip(0,255).astype(np.uint8)

# ═══════════════════════════════════════
# SCENE 1: INTRO
# ═══════════════════════════════════════
def scene1(t):
    img = make_base()
    img = add_light_beams(img, t, alpha=22)
    img = add_particles(img, 70, 42, t)
    draw = ImageDraw.Draw(img)

    # Logo circle
    logo_scale = ease_out(t / 0.8)
    lr = int(80 * logo_scale)
    la = int(255 * min(1.0, t / 0.5))
    cx, cy = W//2, int(H * 0.28)
    if lr > 5:
        ll = Image.new("RGBA", (W, H), (0,0,0,0))
        ld = ImageDraw.Draw(ll)
        for rr in range(lr+25, lr, -4):
            ld.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], fill=(*GOLD, int(la*0.12)))
        ld.ellipse([cx-lr, cy-lr, cx+lr, cy+lr], fill=(*NAVY2, la))
        ld.ellipse([cx-lr, cy-lr, cx+lr, cy+lr], outline=(*GOLD, la), width=3)
        fs = font(int(lr*0.9))
        bb = ld.textbbox((0,0), "S", font=fs)
        ld.text((cx-(bb[2]-bb[0])//2, cy-(bb[3]-bb[1])//2-6), "S", font=fs, fill=(*GOLD, la))
        img = Image.alpha_composite(img.convert("RGBA"), ll).convert("RGB")
        draw = ImageDraw.Draw(img)

    # Brand name
    ba = int(255 * ease_out(max(0, t-0.5)/0.6))
    if ba > 0:
        fb = font(52)
        bb = draw.textbbox((0,0), "SHORTHILLS AI", font=fb)
        bx = (W - (bb[2]-bb[0])) // 2
        draw.text((bx+2, cy+lr+30), "SHORTHILLS AI", font=fb, fill=(0,0,0,ba//3))
        draw.text((bx, cy+lr+28), "SHORTHILLS AI", font=fb, fill=(*GOLD, ba))

    # Title typewriter
    ta1 = ease_out(max(0, t-0.9)/0.8)
    if ta1 > 0:
        ft = font(76)
        ty = int(H*0.47)
        t1 = typewriter("SALES TEAM OF", max(0, t-0.9), 18)
        t2 = typewriter("SHORTHILLS AI", max(0, t-1.7), 18)
        if t1: centered_text(draw, t1, ty, ft, WHITE)
        if t2: centered_text(draw, t2, ty+92, ft, GOLD)

    # Sub
    sa = int(255 * ease_out(max(0, t-2.2)/0.7))
    if sa > 0:
        fs2 = font(33, bold=False)
        sub = "One Team. One Captain. Limitless Possibilities."
        bb2 = draw.textbbox((0,0), sub, font=fs2)
        sw = bb2[2]-bb2[0]
        sx = (W-sw)//2
        sy = int(H*0.61)
        draw.text((sx, sy), sub, font=fs2, fill=(*LGRAY, sa))
        gold_line(draw, sy+44, width=sw+20)

    # Sparkle burst
    if 0.3 < t < 1.3:
        bt = (t-0.3)/1.0
        sl = Image.new("RGBA",(W,H),(0,0,0,0))
        sd = ImageDraw.Draw(sl)
        for i in range(12):
            angle = i/12*math.pi*2
            dist = int(bt*130)
            spx = int(cx + dist*math.cos(angle))
            spy = int(cy + dist*math.sin(angle))
            a_sp = int(255*(1-bt))
            sz2 = max(1, int(6*(1-bt)))
            sd.ellipse([spx-sz2, spy-sz2, spx+sz2, spy+sz2], fill=(*GOLD2, a_sp))
        img = Image.alpha_composite(img.convert("RGBA"), sl).convert("RGB")

    return np.array(img)

# ═══════════════════════════════════════
# SCENE 2: MANAGER
# ═══════════════════════════════════════
def scene2(t):
    img = make_base()
    img = add_light_beams(img, t, cy=int(H*0.22), alpha=18)
    img = add_particles(img, 55, 77, t)
    draw = ImageDraw.Draw(img)

    # Banner
    ba = int(255 * ease_out(t/0.5))
    fb = font(36)
    txt = "THE MANAGER & STRATEGIST"
    bb = draw.textbbox((0,0), txt, font=fb)
    bw = bb[2]-bb[0]
    draw.rectangle([(W//2-bw//2-22, 88), (W//2+bw//2+22, 146)], fill=(*GOLD, ba))
    draw.text(((W-bw)//2, 91), txt, font=fb, fill=(*NAVY, ba))

    # Photo
    ps = ease_out(min(1.0, t/0.6))
    psize = int(370 * ps)
    if psize > 20:
        ph = photo_circle("AG", psize, "visora_assets/ayush.jpg")
        img.paste(ph, (W//2-psize//2, 175), ph)
        draw = ImageDraw.Draw(img)

    # Crown
    ca = int(255 * ease_out(max(0, t-0.5)/0.4))
    if ca > 10:
        cl = Image.new("RGBA",(W,H),(0,0,0,0))
        cd = ImageDraw.Draw(cl)
        cx, cy = W//2, 152
        pts = [(cx-42,cy+38),(cx-55,cy),(cx-22,cy+22),(cx,cy-12),(cx+22,cy+22),(cx+55,cy),(cx+42,cy+38)]
        cd.polygon(pts, fill=(*GOLD, ca))
        cd.polygon(pts, outline=(*GOLD2, ca), width=2)
        cd.ellipse([cx-9, cy-9, cx+9, cy+9], fill=(255,80,80,ca))
        img = Image.alpha_composite(img.convert("RGBA"), cl).convert("RGB")
        draw = ImageDraw.Draw(img)

    # Name
    na = int(255 * ease_out(max(0, t-0.5)/0.5))
    if na > 0:
        fn = font(66)
        bb2 = draw.textbbox((0,0), "AYUSH GRACK", font=fn)
        nw = bb2[2]-bb2[0]
        centered_text(draw, "AYUSH GRACK", 578, fn, WHITE)
        gold_line(draw, 654, width=nw+20)

    # Tagline
    tga = int(255 * ease_out(max(0, t-1.0)/0.5))
    if tga > 0:
        ftg = font(30, bold=False)
        tag = typewriter("The Glue. The Guide. The Game Changer.", max(0, t-1.0), 28)
        bb3 = draw.textbbox((0,0), tag, font=ftg)
        tw = bb3[2]-bb3[0]
        draw.text(((W-tw)//2, 666), tag, font=ftg, fill=(*GOLD2, tga))

    # Speech bubbles helper
    def bubble(text, y, side, t_delay, max_w=430):
        bt = max(0, t - t_delay)
        a = int(255 * ease_out(min(1.0, bt/0.5)))
        if a < 5: return
        fnt_b = font(22, bold=False)
        words = text.split()
        lines, cur = [], ""
        for w in words:
            test = (cur+" "+w).strip()
            bb_t = draw.textbbox((0,0), test, font=fnt_b)
            if bb_t[2]-bb_t[0] > max_w and cur:
                lines.append(cur); cur = w
            else:
                cur = test
        if cur: lines.append(cur)
        lh = 33
        bh = len(lines)*lh + 24
        bw2 = max_w + 22
        bx = 38 if side == 'L' else W-bw2-38
        bl = Image.new("RGBA",(W,H),(0,0,0,0))
        bd = ImageDraw.Draw(bl)
        bd.rounded_rectangle([bx, y, bx+bw2, y+bh], radius=14, fill=(18,34,62,int(a*0.92)))
        bd.rounded_rectangle([bx, y, bx+bw2, y+bh], radius=14, outline=(*GOLD, int(a*0.65)), width=2)
        for i, line in enumerate(lines):
            bd.text((bx+12, y+12+i*lh), line, font=fnt_b, fill=(220,230,248,a))
        return Image.alpha_composite(img.convert("RGBA"), bl).convert("RGB")

    r1 = bubble('"I don\'t just manage people, I unlock their superpowers and multiply their impact."', 730, 'L', 1.8)
    if r1: img = r1; draw = ImageDraw.Draw(img)
    r2 = bubble('"I see the big picture, plan the strategy, and give my team the freedom to win."', 920, 'R', 2.8)
    if r2: img = r2; draw = ImageDraw.Draw(img)

    draw = ImageDraw.Draw(img)

    # Icon row
    it = max(0, t-3.5)
    ia = int(255 * ease_out(min(1.0, it/0.5)))
    if ia > 10:
        icons = ["Strategic\nThinker", "Problem\nSolver", "People\nDev", "Results\nDriven"]
        sp = (W - 100) // len(icons)
        fi2 = font(18)
        for ii, ic in enumerate(icons):
            pt = max(0, it-ii*0.15)
            pa = int(255 * ease_out(min(1.0, pt/0.3)))
            if pa < 5: continue
            ix = 50 + ii*sp
            iy = 1140
            draw.rounded_rectangle([ix, iy, ix+sp-8, iy+58], radius=8, fill=(20,38,70,pa))
            draw.rounded_rectangle([ix, iy, ix+sp-8, iy+58], radius=8, outline=(*GOLD, pa//2), width=1)
            parts = ic.split('\n')
            for pi, part in enumerate(parts):
                bb4 = draw.textbbox((0,0), part, font=fi2)
                pw2 = bb4[2]-bb4[0]
                draw.text((ix+(sp-pw2)//2, iy+8+pi*24), part, font=fi2, fill=(*WHITE, pa))

    return np.array(img)

# ═══════════════════════════════════════
# SCENE 3: PILLAR CARD
# ═══════════════════════════════════════
def scene3(t, person):
    name, subtitle, quote, banner, initials, photo_key = person
    img = make_base()
    img = add_particles(img, 45, hash(name)%999, t)
    draw = ImageDraw.Draw(img)

    slide = ease_out(min(1.0, t/0.4))
    ox = int((1-slide) * -W)

    # Card bg
    cl = Image.new("RGBA",(W,H),(0,0,0,0))
    cd = ImageDraw.Draw(cl)
    cd.rounded_rectangle([40+ox, 110, W-40+ox, H-110], radius=26, fill=(14,30,58,220))
    cd.rounded_rectangle([40+ox, 110, W-40+ox, H-110], radius=26, outline=(*GOLD,155), width=2)
    img = Image.alpha_composite(img.convert("RGBA"), cl).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Top banner
    ta = int(255 * ease_out(max(0, t-0.15)/0.4))
    ft2 = font(30)
    bb = draw.textbbox((0,0), subtitle, font=ft2)
    bw = bb[2]-bb[0]
    draw.rectangle([(W//2-bw//2-18, 132), (W//2+bw//2+18, 180)], fill=(*GOLD, ta))
    draw.text(((W-bw)//2+ox, 134), subtitle, font=ft2, fill=(*NAVY, ta))

    # Photo
    ps2 = ease_out(min(1.0, t/0.5))
    psize2 = int(340 * ps2)
    if psize2 > 15:
        ph2 = photo_circle(initials, psize2, f"visora_assets/{photo_key}.jpg")
        img.paste(ph2, (W//2-psize2//2+ox, 205), ph2)
        draw = ImageDraw.Draw(img)

    # Name
    na2 = int(255 * ease_out(max(0, t-0.4)/0.4))
    if na2 > 0:
        fn2 = font(62)
        bb2 = draw.textbbox((0,0), name, font=fn2)
        nw2 = bb2[2]-bb2[0]
        centered_text(draw, name, 578, fn2, WHITE)
        gold_line(draw, 648, width=nw2)

    # Quote bubble
    qt = max(0, t-0.9)
    qa = int(255 * ease_out(min(1.0, qt/0.5)))
    if qa > 10:
        fq = font(24, bold=False)
        words_q = quote.split()
        lines_q, cur_q = [], ""
        for w in words_q:
            test_q = (cur_q+" "+w).strip()
            bb_q = draw.textbbox((0,0), test_q, font=fq)
            if bb_q[2]-bb_q[0] > W-130 and cur_q:
                lines_q.append(cur_q); cur_q = w
            else:
                cur_q = test_q
        if cur_q: lines_q.append(cur_q)
        lhq = 36
        qbh = len(lines_q)*lhq + 28
        ql = Image.new("RGBA",(W,H),(0,0,0,0))
        qd = ImageDraw.Draw(ql)
        qd.rounded_rectangle([55+ox, 675, W-55+ox, 675+qbh], radius=15,
                              fill=(8,18,38,int(qa*0.92)))
        qd.rounded_rectangle([55+ox, 675, W-55+ox, 675+qbh], radius=15,
                              outline=(*GOLD, int(qa*0.6)), width=2)
        fqm = font(48)
        qd.text((65+ox, 660), "“", font=fqm, fill=(*GOLD, int(qa*0.4)))
        for qi, ql_txt in enumerate(lines_q):
            qd.text((68+ox, 685+qi*lhq), ql_txt, font=fq, fill=(220,230,248,qa))
        img = Image.alpha_composite(img.convert("RGBA"), ql).convert("RGB")
        draw = ImageDraw.Draw(img)

    # Bottom banner
    bt2 = max(0, t-1.5)
    ba2 = int(255 * ease_out(min(1.0, bt2/0.4)))
    if ba2 > 10:
        fba = font(34)
        bb3 = draw.textbbox((0,0), banner, font=fba)
        bw3 = bb3[2]-bb3[0]
        ban_y = H - 188
        draw.rectangle([(42+ox, ban_y), (W-42+ox, ban_y+58)], fill=(*GOLD, ba2))
        draw.text(((W-bw3)//2+ox, ban_y+8), banner, font=fba, fill=(*NAVY, ba2))

    return np.array(img)

# ═══════════════════════════════════════
# SCENE 4: SENIOR LEADERS
# ═══════════════════════════════════════
def scene4(t):
    img = make_base()
    img = add_particles(img, 65, 55, t)
    draw = ImageDraw.Draw(img)

    # Header
    ha = int(255 * ease_out(t/0.5))
    fh = font(42)
    hdr = "SENIOR SALES LEADERS"
    bb = draw.textbbox((0,0), hdr, font=fh)
    hw = bb[2]-bb[0]
    draw.rectangle([(W//2-hw//2-22, 78), (W//2+hw//2+22, 136)], fill=(*GOLD, ha))
    draw.text(((W-hw)//2, 80), hdr, font=fh, fill=(*NAVY, ha))

    # Left: Aryan
    lt = ease_out(min(1.0, t/0.65))
    lox = int((1-lt)*-420)
    ph_l = photo_circle("AK", 290, "visora_assets/aryan.jpg")
    img.paste(ph_l, (72+lox, 168), ph_l)
    draw = ImageDraw.Draw(img)

    na_l = int(255 * ease_out(max(0, t-0.3)/0.4))
    if na_l > 0:
        fnl = font(32)
        draw.text((48+lox, 478), "ARYAN KUSHWAHA", font=fnl, fill=(*WHITE, na_l))
        fnl2 = font(22, bold=False)
        draw.text((48+lox, 520), "Sales is Not a Job,", font=fnl2, fill=(*GOLD2, na_l))
        draw.text((48+lox, 548), "It's My Game!", font=fnl2, fill=(*GOLD2, na_l))

    q1t = max(0, t-0.8)
    q1a = int(255 * ease_out(min(1.0, q1t/0.5)))
    if q1a > 10:
        ql1 = Image.new("RGBA",(W,H),(0,0,0,0))
        qd1 = ImageDraw.Draw(ql1)
        fq1 = font(24, bold=False)
        qd1.rounded_rectangle([42+lox, 588, 470+lox, 678], radius=12,
                               fill=(8,18,40,int(q1a*0.9)))
        qd1.rounded_rectangle([42+lox, 588, 470+lox, 678], radius=12,
                               outline=(*GOLD, q1a//2), width=2)
        qd1.text((56+lox, 598), '"Deal Nahi,', font=fq1, fill=(220,230,248,q1a))
        qd1.text((56+lox, 636), 'Dil Jeetna Hai!"', font=fq1, fill=(220,230,248,q1a))
        img = Image.alpha_composite(img.convert("RGBA"), ql1).convert("RGB")
        draw = ImageDraw.Draw(img)

    # Right: Himanshu
    rt = ease_out(min(1.0, max(0, t-0.2)/0.65))
    rox = int((1-rt)*420)
    ph_r = photo_circle("HY", 290, "visora_assets/himanshu.jpg")
    img.paste(ph_r, (W-362+rox, 168), ph_r)
    draw = ImageDraw.Draw(img)

    if na_l > 0:
        fnr = font(32)
        draw.text((W-442+rox, 478), "HIMANSHU YADAV", font=fnr, fill=(*WHITE, na_l))
        fnr2 = font(22, bold=False)
        draw.text((W-442+rox, 520), "Professional.", font=fnr2, fill=(*GOLD2, na_l))
        draw.text((W-442+rox, 548), "Silent Killer.", font=fnr2, fill=(*GOLD2, na_l))

    q2t = max(0, t-1.0)
    q2a = int(255 * ease_out(min(1.0, q2t/0.5)))
    if q2a > 10:
        ql2 = Image.new("RGBA",(W,H),(0,0,0,0))
        qd2 = ImageDraw.Draw(ql2)
        fq2 = font(20, bold=False)
        qd2.rounded_rectangle([W-488+rox, 588, W-40+rox, 700], radius=12,
                               fill=(8,18,40,int(q2a*0.9)))
        qd2.rounded_rectangle([W-488+rox, 588, W-40+rox, 700], radius=12,
                               outline=(*GOLD, q2a//2), width=2)
        qd2.text((W-476+rox, 598), '"AWS, GCP, Microsoft,', font=fq2, fill=(220,230,248,q2a))
        qd2.text((W-476+rox, 630), 'Snowflake & Databricks.', font=fq2, fill=(220,230,248,q2a))
        qd2.text((W-476+rox, 660), 'Partnerships. Perfected."', font=fq2, fill=(220,230,248,q2a))
        img = Image.alpha_composite(img.convert("RGBA"), ql2).convert("RGB")
        draw = ImageDraw.Draw(img)

    # Center glow + divider
    glt = max(0, t-0.5)
    gla = int(255 * ease_out(min(1.0, glt/0.5)))
    if gla > 10:
        gl = Image.new("RGBA",(W,H),(0,0,0,0))
        gd = ImageDraw.Draw(gl)
        cx = W//2; cy2 = 320
        for rr in range(55, 0, -8):
            gd.ellipse([cx-rr, cy2-rr, cx+rr, cy2+rr], fill=(*GOLD, int(gla*0.25*(1-rr/55))))
        gd.ellipse([cx-28, cy2-28, cx+28, cy2+28], fill=(*GOLD, gla//2))
        fp = font(36)
        bb_p = gd.textbbox((0,0), "+", font=fp)
        gd.text((cx-(bb_p[2]-bb_p[0])//2, cy2-(bb_p[3]-bb_p[1])//2-4), "+", font=fp, fill=(*NAVY, gla))
        gd.line([(370, cy2), (cx-30, cy2)], fill=(*GOLD, gla//2), width=2)
        gd.line([(cx+30, cy2), (W-370, cy2)], fill=(*GOLD, gla//2), width=2)
        img = Image.alpha_composite(img.convert("RGBA"), gl).convert("RGB")
        draw = ImageDraw.Draw(img)

    # Center banner
    cbt = max(0, t-2.0)
    cba = int(255 * ease_out(min(1.0, cbt/0.6)))
    if cba > 10:
        fcb = font(30)
        lines_cb = ["BACKED BY THE BEST.", "DRIVEN BY THE MISSION."]
        for ci, cl2 in enumerate(lines_cb):
            bb_cb = draw.textbbox((0,0), cl2, font=fcb)
            cw = bb_cb[2]-bb_cb[0]
            cy_cb = 740 + ci*50
            draw.rectangle([(W//2-cw//2-14, cy_cb-4), (W//2+cw//2+14, cy_cb+44)], fill=(*GOLD, cba))
            draw.text(((W-cw)//2, cy_cb), cl2, font=fcb, fill=(*NAVY, cba))

    # Partner logos
    plt = max(0, t-3.0)
    pla = int(255 * ease_out(min(1.0, plt/0.5)))
    if pla > 10:
        logos = ["AWS", "GCP", "Azure", "Snowflake", "Databricks"]
        sp2 = (W-100)//len(logos)
        fl2 = font(20)
        for li, ln in enumerate(logos):
            lt2 = max(0, plt-li*0.1)
            la2 = int(255 * ease_out(min(1.0, lt2/0.3)))
            if la2 < 5: continue
            lx2 = 50 + li*sp2
            draw.rounded_rectangle([lx2, 862, lx2+sp2-8, 912], radius=8, fill=(20,40,75,la2))
            draw.rounded_rectangle([lx2, 862, lx2+sp2-8, 912], radius=8, outline=(*GOLD, la2//2), width=1)
            bb_l2 = draw.textbbox((0,0), ln, font=fl2)
            lw2 = bb_l2[2]-bb_l2[0]
            draw.text((lx2+(sp2-lw2)//2, 876), ln, font=fl2, fill=(*WHITE, la2))

    return np.array(img)

# ═══════════════════════════════════════
# SCENE 5: CLOSING
# ═══════════════════════════════════════
def scene5(t):
    img = make_base()
    img = add_light_beams(img, t, alpha=38)
    img = add_particles(img, 110, 99, t, color=GOLD)
    draw = ImageDraw.Draw(img)

    # Photo grid
    ga = int(200 * ease_out(min(1.0, t/0.8)))
    if ga > 10:
        members = [
            ("AG","ayush"),("PR","pratham"),("DH","dhruv"),
            ("SM","sameer"),("TJ","tejaswi"),("AR","arsh"),
            ("KS","kashish"),("AK","aryan"),("HY","himanshu")
        ]
        tile = 238
        cols = 3
        gw = cols*tile + (cols-1)*8
        gx0 = (W-gw)//2
        gy0 = 175
        for mi, (init, pk) in enumerate(members):
            ci, ri = mi % cols, mi // cols
            pt = max(0, t-mi*0.07)
            pa = int(ga * ease_out(min(1.0, pt/0.3)))
            if pa < 5: continue
            tx = gx0 + ci*(tile+8)
            ty = gy0 + ri*(tile+8)
            ph = photo_circle(init, tile, f"visora_assets/{pk}.jpg")
            ph_arr = np.array(ph).astype(np.float32)
            ph_arr[:,:,3] = ph_arr[:,:,3] * pa / 255
            img.paste(Image.fromarray(ph_arr.clip(0,255).astype(np.uint8)), (tx, ty),
                      Image.fromarray(ph_arr[:,:,3].clip(0,255).astype(np.uint8)).convert("L"))

        draw = ImageDraw.Draw(img)

    # Text overlays with dark backing
    def text_block(text, y, fnt, color, t_delay):
        ta = int(255 * ease_out(max(0, t-t_delay)/0.5))
        if ta < 5: return
        bb = draw.textbbox((0,0), text, font=fnt)
        tw = bb[2]-bb[0]
        draw.rectangle([(0, y-6), (W, y+(bb[3]-bb[1])+10)], fill=(5,12,25,int(ta*0.88)))
        centered_text(draw, text, y, fnt, (*color, ta) if len(color)==3 else color)

    text_block("ONE VISION.", 1088, font(68), WHITE, 1.2)
    text_block("ONE TEAM.", 1168, font(68), WHITE, 1.6)
    text_block("ENDLESS IMPACT.", 1248, font(56), GOLD, 2.0)

    sub_a = int(255 * ease_out(max(0, t-2.6)/0.5))
    if sub_a > 10:
        fs3 = font(29, bold=False)
        sub3 = "We don't just work together, we win together!"
        bb3 = draw.textbbox((0,0), sub3, font=fs3)
        sw3 = bb3[2]-bb3[0]
        draw.rectangle([(0, 1336), (W, 1384)], fill=(5,12,25,int(sub_a*0.88)))
        draw.text(((W-sw3)//2, 1340), sub3, font=fs3, fill=(*LGRAY, sub_a))

    # Final logo
    lt = max(0, t-3.5)
    la = int(255 * ease_out(min(1.0, lt/0.6)))
    if la > 10:
        pulse = 0.5 + 0.5*math.sin(t*4.0)
        lr2 = int(72 + pulse*9)
        cx2, cy2 = W//2, 1575
        ll = Image.new("RGBA",(W,H),(0,0,0,0))
        ld3 = ImageDraw.Draw(ll)
        for rr in range(lr2+45, lr2, -6):
            ld3.ellipse([cx2-rr, cy2-rr, cx2+rr, cy2+rr], fill=(*GOLD, int(la*0.18*(1-(rr-lr2)/45))))
        ld3.ellipse([cx2-lr2, cy2-lr2, cx2+lr2, cy2+lr2], fill=(*NAVY2, la))
        ld3.ellipse([cx2-lr2, cy2-lr2, cx2+lr2, cy2+lr2], outline=(*GOLD, la), width=3)
        fls = font(int(lr2*0.92))
        bb_s = ld3.textbbox((0,0), "S", font=fls)
        ld3.text((cx2-(bb_s[2]-bb_s[0])//2, cy2-(bb_s[3]-bb_s[1])//2-6), "S", font=fls, fill=(*GOLD, la))
        img = Image.alpha_composite(img.convert("RGBA"), ll).convert("RGB")
        draw = ImageDraw.Draw(img)
        fbr = font(40)
        bb_br = draw.textbbox((0,0), "SHORTHILLS AI", font=fbr)
        draw.text(((W-(bb_br[2]-bb_br[0]))//2, 1660), "SHORTHILLS AI", font=fbr, fill=(*GOLD, la))

    return np.array(img)

# ═══════════════════════════════════════
# PILLARS DATA
# ═══════════════════════════════════════
PILLARS = [
    ("PRATHAM",  "CHATTUR, INTELLIGENT",
     '"Dimag computer se tez, jugaad Top Class!"',
     "Brains + Strategy = Pratham",      "PR", "pratham"),
    ("DHRUV",    "SKODA, SMART & CLEVER",
     '"Simple look, Smart & Clever mind!"',
     "Keep It Smart. Keep It Clever.",   "DH", "dhruv"),
    ("SAMEER",   "ALWAYS ALONE",
     '"Log apne group me busy, Sameer apne thoughts me busy."',
     "No Group. No Problem.",            "SM", "sameer"),
    ("TEJASWI",  "GABBAR",
     '"Pehle khana, phir kaam!"',
     "Master Chef of the Team!",         "TJ", "tejaswi"),
    ("ARSH",     "REAL ESTATE AGENT",
     '"Deal pakki, commission pakka!"',
     "Ghar, Plot, Office - Arsh Sab Jod De!", "AR", "arsh"),
    ("KASHISH",  "MENTALLY LOST GIRL",
     '"Na idhar ki, na udhar ki... kuch samajh nahi aaya."',
     "Still Loading... Please Wait",     "KS", "kashish"),
]

# ═══════════════════════════════════════
# MAIN RENDER
# ═══════════════════════════════════════
if __name__ == "__main__":
    Path("visora_output/videos").mkdir(parents=True, exist_ok=True)
    out_path = "visora_output/videos/shorthills_sales_reel_silent.mp4"
    TRANS = int(0.3 * FPS)

    writer = imageio.get_writer(
        out_path, fps=FPS, codec='libx264', quality=9,
        ffmpeg_log_level='quiet',
        ffmpeg_params=['-pix_fmt','yuv420p','-crf','18','-preset','fast'],
        macro_block_size=1
    )

    schedule = [
        ("S1 Intro",        scene1,   None,     4.0),
        ("S2 Manager",      scene2,   None,    10.0),
    ] + [
        (f"S3.{i+1} {p[0]}", scene3, p, 5.0) for i, p in enumerate(PILLARS)
    ] + [
        ("S4 Senior",       scene4,   None,    10.0),
        ("S5 Closing",      scene5,   None,     6.0),
    ]

    last_frame = None
    total_f = sum(int(d*FPS) for _,_,_,d in schedule)
    rendered = 0

    for label, fn, arg, dur in schedule:
        n = int(dur * FPS)
        print(f"  [{label}] {n} frames...")
        frames = []
        for fi in range(n):
            frame = fn(fi/FPS) if arg is None else fn(fi/FPS, arg)
            frames.append(frame)
            if fi % 60 == 0:
                pct = int((rendered+fi)/total_f*100)
                print(f"    {pct}%", end='\r')
        for fi, frame in enumerate(frames):
            if last_frame is not None and fi < TRANS:
                writer.append_data(blend(last_frame, frame, fi/TRANS))
            else:
                writer.append_data(frame)
        last_frame = frames[-1]
        rendered += n
        print(f"    100% done")

    writer.close()
    sz = os.path.getsize(out_path)
    print(f"\nVIDEO SAVED: {out_path}  ({sz/1024/1024:.1f} MB, {total_f/FPS:.0f}s)")
