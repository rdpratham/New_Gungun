"""
Ghibli-style one-by-one team intro video for Shorthills AI Sales Team.
1920x1080, ~55s, each member gets their own animated watercolor card.
"""
import numpy as np, os, subprocess, struct, wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

import imageio, imageio_ffmpeg
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

W, H = 1920, 1080
FPS  = 30

# ─── Font ─────────────────────────────────────────────────────────────────
def fnt(size, bold=True):
    for p in ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        try: return ImageFont.truetype(p, size)
        except: pass
    return ImageFont.load_default()

# ─── Easing ───────────────────────────────────────────────────────────────
def ease_out(t): return 1-(1-min(t,1))**3
def ease_in(t):  return min(t,1)**3
def ease_io(t):  t=min(t,1); return 3*t**2-2*t**3
def lerp(a,b,t): return a+(b-a)*min(max(t,0),1)

# ─── Team data (from reference infographic) ───────────────────────────────
TEAM = [
    {
        "key": "ayush",
        "name": "AYUSH GRACK",
        "title": "The Manager & Strategist",
        "subtitle": "The Glue. The Guide. The Game Changer.",
        "nickname": "⭐ Captain ⭐",
        "quote": "I don't just manage people,\nI unlock their superpowers\nand multiply their impact.",
        "quote2": "I see the big picture, plan\nthe strategy and give my\nteam the freedom to win!",
        "tag": "Strategic Thinker · People Developer · Results Driven",
        "banner": "Ayush & The Team Have Their Back!",
        "palette": ((15,30,70),(180,140,50),(255,220,100),(240,240,200)),   # deep navy, gold
        "spirit": "🌟",
    },
    {
        "key": "pratham",
        "name": "PRATHAM",
        "title": "Chattur – Intelligent",
        "subtitle": "Brains + Strategy = Pratham",
        "nickname": "The Thinker",
        "quote": "Dimag computer se tez,\njugaad Top ClaSS!",
        "quote2": "",
        "tag": "Strategic · Analytical · Always Two Steps Ahead",
        "banner": "Brains + Strategy = Pratham",
        "palette": ((20,60,50),(80,160,120),(180,240,200),(240,255,245)),   # mint green
        "spirit": "🧠",
    },
    {
        "key": "dhruv",
        "name": "DHRUV",
        "title": "Skoda – Smart & Clever",
        "subtitle": "Keep It Smart. Keep It Clever.",
        "nickname": "Smart Move",
        "quote": "Simple look,\nSmart & Clever mind!",
        "quote2": "",
        "tag": "Smart · Clever · Always Wins",
        "banner": "Keep It Smart. Keep It Clever.",
        "palette": ((25,50,30),(60,120,70),(160,210,140),(230,255,220)),   # forest green
        "spirit": "🏆",
    },
    {
        "key": "sameer",
        "name": "SAMEER",
        "title": "Always Alone",
        "subtitle": "No Group. No Problem.",
        "nickname": "The Lone Wolf",
        "quote": "Log apne group me busy,\nSameer apne thoughts\nme busy.",
        "quote2": "",
        "tag": "Independent · Focused · Deep Thinker",
        "banner": "No Group. No Problem.",
        "palette": ((40,30,70),(100,80,160),(180,160,220),(230,220,255)),   # lavender
        "spirit": "🌙",
    },
    {
        "key": "tejaswi",
        "name": "TEJASWI",
        "title": "Gabbar",
        "subtitle": "Master Chef of the Team!",
        "nickname": "Kitchen Ka Gabbar 🍳",
        "quote": "Pehle khana,\nphir kaam!",
        "quote2": "",
        "tag": "Energetic · Bold · Always Hungry for Success",
        "banner": "Master Chef of the Team!",
        "palette": ((70,35,10),(200,110,30),(255,185,80),(255,245,210)),   # warm orange
        "spirit": "🔥",
    },
    {
        "key": "arsh",
        "name": "ARSH",
        "title": "Real Estate Agent",
        "subtitle": "Ghar, Plot, Office – Arsh Sab Jod De!",
        "nickname": "Deal Closer",
        "quote": "Deal pakki,\ncommission pakka!",
        "quote2": "DEAL CLOSE\nKARWAKE\nRAHENGE!",
        "tag": "Deal Maker · Connector · Never Takes No",
        "banner": "Ghar, Plot, Office – Arsh Sab Jod De!",
        "palette": ((10,50,60),(30,130,140),(100,210,200),(210,250,248)),   # teal
        "spirit": "🤝",
    },
    {
        "key": "kashish",
        "name": "KASHISH",
        "title": "Mentally Lost Girl",
        "subtitle": "Still Loading... Please Wait",
        "nickname": "?? Kya ho raha hu ??",
        "quote": "Na idhar ki, na udhar ki...\nkuch samajh nahi aaya!",
        "quote2": "Mujhe kya chahiye?",
        "tag": "Creative · Unique · Always Surprising",
        "banner": "Still Loading... Please Wait ⏳",
        "palette": ((70,20,60),(180,80,150),(240,160,220),(255,230,248)),   # pink
        "spirit": "🌸",
    },
    {
        "key": "aryan",
        "name": "ARYAN KUSHWAHA",
        "title": "Kuch Bhi Ho, Bech Denge! 😎",
        "subtitle": "Sales is Not a Job, It's My Game!",
        "nickname": "The Deal Machine",
        "quote": "Technology engineer se\nzyada aati hai.\nNo excuses. Only Results.",
        "quote2": "DEAL NAHI,\nDIL JEETNA\nHAI!",
        "tag": "Fearless · Relentless · Born to Sell",
        "banner": "Sales is Not a Job, It's My Game!",
        "palette": ((60,10,10),(180,40,30),(240,100,70),(255,220,200)),   # crimson
        "spirit": "⚡",
    },
    {
        "key": "himanshu",
        "name": "HIMANSHU YADAV",
        "title": "Professional. Serious. Silent Killer.",
        "subtitle": "Lifescience? I will add!",
        "nickname": "The Silent Closer",
        "quote": "Expression nahi\ndikhaaunga.\nPar result zaroor\ndikhaunga.",
        "quote2": "Jis industry me kabhi kuch\nnahi becha, waha bechega main.",
        "tag": "Professional · Strategic · Silent but Deadly",
        "banner": "Lifescience? I will add! 🌿",
        "palette": ((15,30,50),(40,80,120),(100,160,200),(210,235,255)),   # steel blue
        "spirit": "🎯",
    },
]

# ─── Watercolor background ─────────────────────────────────────────────────
def watercolor_bg(dark, mid, light, pale, seed=0):
    """Create a Ghibli-style painterly watercolor background."""
    rng = np.random.default_rng(seed)
    canvas = Image.new("RGB", (W,H), dark)
    draw = ImageDraw.Draw(canvas)

    # Large soft bokeh blobs (background atmosphere)
    for _ in range(25):
        x = int(rng.integers(0, W)); y = int(rng.integers(0, H))
        r = int(rng.integers(80, 350))
        c = mid if rng.random()>0.5 else light
        alpha = int(rng.integers(15, 55))
        ov = Image.new("RGBA",(W,H),(0,0,0,0))
        ImageDraw.Draw(ov).ellipse([x-r,y-r,x+r,y+r], fill=(*c,alpha))
        _r,_g,_b,_a = ov.split()
        _a = _a.filter(ImageFilter.GaussianBlur(max(1, r//2)))
        ov = Image.merge("RGBA",(_r,_g,_b,_a))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")

    # Soft noise grain (paper texture)
    noise_arr = rng.integers(0,25,(H,W,3),dtype=np.uint8)
    grain = Image.fromarray(noise_arr)
    canvas = Image.blend(canvas.convert("RGB"), grain.convert("RGB"), 0.06)

    # Diagonal light beam (Ghibli signature)
    ov2 = Image.new("RGBA",(W,H),(0,0,0,0))
    d2 = ImageDraw.Draw(ov2)
    for beam in range(3):
        bx = rng.integers(W//4, 3*W//4)
        d2.polygon([(bx-80,0),(bx+80,0),(bx+200,H),(bx-200,H)],
                   fill=(*pale, 18))
    # blur each channel separately via split/merge
    r2,g2,b2,a2 = ov2.split()
    a2 = a2.filter(ImageFilter.GaussianBlur(30))
    ov2 = Image.merge("RGBA",(r2,g2,b2,a2))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), ov2).convert("RGB")

    return canvas

# ─── Bokeh particles ──────────────────────────────────────────────────────
def add_bokeh(canvas, colors, t_phase, seed=0):
    rng = np.random.default_rng(seed)
    ov = Image.new("RGBA",(W,H),(0,0,0,0))
    for i in range(18):
        x = int(rng.integers(50,W-50) + np.sin(t_phase+i)*30)
        y = int(rng.integers(50,H-50) + np.cos(t_phase*0.7+i)*20)
        r = int(rng.integers(4,22))
        c = colors[i % len(colors)]
        alpha = int(rng.integers(40,120))
        ImageDraw.Draw(ov).ellipse([x-r,y-r,x+r,y+r], fill=(*c,alpha))
    _r,_g,_b,_a = ov.split()
    _a = _a.filter(ImageFilter.GaussianBlur(6))
    ov = Image.merge("RGBA",(_r,_g,_b,_a))
    return Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")

# ─── Decorative border ────────────────────────────────────────────────────
def draw_border(draw, x0,y0,x1,y1, color, width=4, corner=20):
    """Rounded rect border with hand-drawn wobble."""
    draw.rounded_rectangle([x0,y0,x1,y1], radius=corner,
                            outline=color, width=width)
    # inner glow line
    draw.rounded_rectangle([x0+6,y0+6,x1-6,y1-6], radius=corner-4,
                            outline=(*color[:3], 60), width=2)

# ─── Photo circle (initials or photo) ─────────────────────────────────────
def photo_circle(canvas, cx, cy, r, initials, bg1, bg2, border_col,
                 photo_path=None):
    # Try real photo first
    img_src = None
    if photo_path and os.path.exists(photo_path):
        try:
            img_src = Image.open(photo_path).convert("RGB")
        except: pass

    ov = Image.new("RGBA",(W,H),(0,0,0,0))
    if img_src:
        # Circular crop
        sq = min(img_src.size)
        sx = (img_src.width-sq)//2; sy = (img_src.height-sq)//2
        img_sq = img_src.crop((sx,sy,sx+sq,sy+sq)).resize((r*2,r*2), Image.LANCZOS)
        mask = Image.new("L",(r*2,r*2),0)
        ImageDraw.Draw(mask).ellipse([0,0,r*2-1,r*2-1], fill=255)
        ov.paste(img_sq.convert("RGBA"), (cx-r,cy-r), mask)
    else:
        # Gradient circle
        for ri in range(r,0,-2):
            t_g = ri/r
            c = tuple(int(lerp(bg2[i],bg1[i],t_g)) for i in range(3))
            ImageDraw.Draw(ov).ellipse([cx-ri,cy-ri,cx+ri,cy+ri], fill=(*c,255))
        # Initials
        fn = fnt(r//2)
        bbox = fn.getbbox(initials)
        tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
        ImageDraw.Draw(ov).text((cx-tw//2, cy-th//2), initials,
                                font=fn, fill=(255,255,255,230))

    # Border ring
    d = ImageDraw.Draw(ov)
    d.ellipse([cx-r-5,cy-r-5,cx+r+5,cy+r+5], outline=(*border_col,220), width=5)
    d.ellipse([cx-r-10,cy-r-10,cx+r+10,cy+r+10], outline=(*border_col,80), width=3)
    return Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")

# ─── Speech bubble ────────────────────────────────────────────────────────
def speech_bubble(canvas, text, bx, by, max_w, fn, bg, fg, border_col):
    if not text: return canvas
    draw = ImageDraw.Draw(canvas)
    lines = text.split("\n")
    line_h = fn.size + 6
    bw = max(fn.getbbox(l)[2]-fn.getbbox(l)[0] for l in lines) + 28
    bw = min(bw, max_w)
    bh = len(lines)*line_h + 20
    bx2, by2 = bx+bw, by+bh

    ov = Image.new("RGBA",(W,H),(0,0,0,0))
    d = ImageDraw.Draw(ov)
    d.rounded_rectangle([bx,by,bx2,by2], radius=14, fill=(*bg,220))
    d.rounded_rectangle([bx,by,bx2,by2], radius=14, outline=(*border_col,200), width=3)
    # Tail
    d.polygon([(bx+30,by2),(bx+20,by2+22),(bx+52,by2)], fill=(*bg,220))
    d.line([(bx+20,by2+22),(bx+30,by2)], fill=(*border_col,200), width=3)
    d.line([(bx+20,by2+22),(bx+52,by2)], fill=(*border_col,200), width=3)

    canvas = Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")
    draw = ImageDraw.Draw(canvas)
    for li, line in enumerate(lines):
        draw.text((bx+14, by+10+li*line_h), line, font=fn, fill=fg)
    return canvas

# ─── Star / spirit decoration ─────────────────────────────────────────────
def draw_stars(draw, color, seed, count=12):
    rng = np.random.default_rng(seed)
    for _ in range(count):
        x = int(rng.integers(30,W-30)); y = int(rng.integers(30,H-30))
        s = int(rng.integers(3,10))
        alpha = int(rng.integers(80,200))
        # 4-point star
        pts = [(x,y-s),(x+s//3,y-s//3),(x+s,y),(x+s//3,y+s//3),
               (x,y+s),(x-s//3,y+s//3),(x-s,y),(x-s//3,y-s//3)]
        draw.polygon(pts, fill=(*color[:3], alpha))

# ─── Main card frame renderer ─────────────────────────────────────────────
def render_member_card(member, f_local, total_f=150):
    """Render one frame of a member's intro card."""
    t = f_local / total_f
    dark, mid, light, pale = member["palette"]

    # Phase: in(0-0.2) → hold(0.2-0.8) → out(0.8-1.0)
    if t < 0.2:
        anim_t = ease_out(t / 0.2)
        phase = "in"
    elif t < 0.8:
        anim_t = 1.0
        phase = "hold"
    else:
        anim_t = ease_in(1 - (t - 0.8) / 0.2)
        phase = "out"

    # Background
    bg = watercolor_bg(dark, mid, light, pale, seed=hash(member["key"])%9999)

    # Bokeh animated
    bg = add_bokeh(bg, [mid,light,pale], t*6, seed=hash(member["key"])%777)

    # Stars
    draw = ImageDraw.Draw(bg)
    draw_stars(draw, pale, seed=hash(member["key"])%333)

    # ── Card slide-in from bottom ──────────────────────────────────────────
    card_y_off = int(lerp(200, 0, anim_t))
    card_alpha = int(anim_t * 255)

    # Layout: left photo zone + right text zone
    card_x0, card_y0 = 80, 60 + card_y_off
    card_x1, card_y1 = W - 80, H - 60 + card_y_off
    CW = card_x1 - card_x0
    CH = card_y1 - card_y0

    # Card background (semi-transparent, watercolor paper feel)
    card_ov = Image.new("RGBA",(W,H),(0,0,0,0))
    d_card = ImageDraw.Draw(card_ov)
    bg_card = tuple(max(0,c-80) for c in dark[:3])
    d_card.rounded_rectangle([card_x0, card_y0, card_x1, card_y1],
                              radius=32, fill=(*bg_card, 200))
    # Inner warm tint strip on right
    d_card.rounded_rectangle([card_x0+CW//3, card_y0, card_x1, card_y1],
                              radius=32, fill=(*dark, 40))
    bg = Image.alpha_composite(bg.convert("RGBA"), card_ov).convert("RGB")
    draw = ImageDraw.Draw(bg)

    # Border
    draw_border(draw, card_x0, card_y0, card_x1, card_y1,
                color=(*light[:3], card_alpha), width=4)

    # ── LEFT ZONE: Photo + Name + Spirit ──────────────────────────────────
    photo_cx = card_x0 + CW//3//2
    photo_cy = card_y0 + CH//2 - 30
    photo_r  = min(CH//3, 180)

    initials = "".join(w[0].upper() for w in member["name"].split()[:2])
    bg = photo_circle(bg, photo_cx, photo_cy, photo_r, initials,
                      mid, dark, light,
                      f"visora_assets/{member['key']}.jpg")
    draw = ImageDraw.Draw(bg)

    # Spirit emoji + nickname above photo
    fn_spirit = fnt(36, bold=False)
    spirit_txt = f"{member['spirit']}  {member['nickname']}"
    bbox = fn_spirit.getbbox(spirit_txt)
    sw = bbox[2]-bbox[0]
    draw.text((photo_cx - sw//2, card_y0 + 28),
              spirit_txt, font=fn_spirit, fill=(*pale[:3], card_alpha))

    # Name below photo
    fn_name = fnt(52)
    name_lines = member["name"].split()
    # single line if short, else split
    if len(member["name"]) > 14:
        mid_i = len(name_lines)//2
        nl1 = " ".join(name_lines[:mid_i]); nl2 = " ".join(name_lines[mid_i:])
        name_parts = [nl1, nl2]
    else:
        name_parts = [member["name"]]

    ny_start = photo_cy + photo_r + 18
    for ni, np_ in enumerate(name_parts):
        bbox = fn_name.getbbox(np_)
        nw = bbox[2]-bbox[0]
        # shadow
        draw.text((photo_cx-nw//2+2, ny_start+ni*58+2), np_,
                  font=fn_name, fill=(0,0,0,int(card_alpha*0.5)))
        draw.text((photo_cx-nw//2, ny_start+ni*58), np_,
                  font=fn_name, fill=(*pale[:3], card_alpha))

    # ── RIGHT ZONE: Title, Quote, Tags ────────────────────────────────────
    rx0 = card_x0 + CW//3 + 30
    ry0 = card_y0 + 40
    rw  = card_x1 - rx0 - 30

    # Title
    fn_title = fnt(28, bold=False)
    draw.text((rx0, ry0), member["title"], font=fn_title,
              fill=(*light[:3], card_alpha))

    # Subtitle (large, prominent)
    fn_sub = fnt(44)
    sub_lines = member["subtitle"].split(". ")
    for si, sl in enumerate(sub_lines[:2]):
        draw.text((rx0, ry0+38+si*52), sl+"." if si<len(sub_lines)-1 else sl,
                  font=fn_sub, fill=(*pale[:3], card_alpha))

    # Decorative line
    line_y = ry0 + 38 + min(2,len(sub_lines))*52 + 12
    draw.line([(rx0, line_y), (rx0+rw*3//4, line_y)],
              fill=(*light[:3], card_alpha), width=3)

    # Quote bubble 1
    if member["quote"]:
        fn_q = fnt(26, bold=False)
        bg = speech_bubble(bg, member["quote"],
                           rx0, line_y+20, rw-20,
                           fn_q, mid, pale, light)
        draw = ImageDraw.Draw(bg)

    # Quote 2 (smaller, offset right)
    q2_y = line_y + 20
    for l in member["quote"].split("\n"):
        q2_y += 34
    q2_y += 40

    if member["quote2"]:
        fn_q2 = fnt(24, bold=False)
        bg = speech_bubble(bg, member["quote2"],
                           rx0 + rw//2, q2_y, rw//2,
                           fn_q2, dark, light, mid)
        draw = ImageDraw.Draw(bg)

    # Tag strip
    fn_tag = fnt(22, bold=False)
    tag_y = card_y1 - 80
    tag_bbox = fn_tag.getbbox(member["tag"])
    tw = tag_bbox[2]-tag_bbox[0]
    draw.rounded_rectangle([rx0-10, tag_y-10, rx0+tw+20, tag_y+36],
                            radius=10, fill=(*mid[:3], int(card_alpha*0.7)))
    draw.text((rx0, tag_y), member["tag"], font=fn_tag,
              fill=(*pale[:3], card_alpha))

    # ── Top color banner ───────────────────────────────────────────────────
    banner_ov = Image.new("RGBA",(W,H),(0,0,0,0))
    d_ban = ImageDraw.Draw(banner_ov)
    d_ban.rounded_rectangle([card_x0, card_y0, card_x1, card_y0+70],
                             radius=32, fill=(*mid[:3], int(card_alpha*0.85)))
    bg = Image.alpha_composite(bg.convert("RGBA"), banner_ov).convert("RGB")
    draw = ImageDraw.Draw(bg)
    fn_ban = fnt(32)
    bbox_ban = fn_ban.getbbox(member["banner"])
    bw = bbox_ban[2]-bbox_ban[0]
    draw.text(((W-bw)//2, card_y0+15), member["banner"],
              font=fn_ban, fill=(*pale[:3], card_alpha))

    # ── Member number badge ────────────────────────────────────────────────
    idx = next(i for i,m in enumerate(TEAM) if m["key"]==member["key"])
    badge_txt = f"{idx+1} / {len(TEAM)}"
    fn_badge = fnt(22, bold=False)
    draw.text((card_x1-90, card_y0+15), badge_txt, font=fn_badge,
              fill=(*pale[:3], int(card_alpha*0.7)))

    # ── Pulse ring on photo (hold phase) ──────────────────────────────────
    if phase == "hold":
        pulse = 0.5 + 0.5*np.sin(t*8*np.pi)
        pr = photo_r + int(pulse*18)
        if pr > 0:
            ov_p = Image.new("RGBA",(W,H),(0,0,0,0))
            ImageDraw.Draw(ov_p).ellipse(
                [photo_cx-pr, photo_cy-pr, photo_cx+pr, photo_cy+pr],
                outline=(*light[:3], int(pulse*120)), width=3)
            bg = Image.alpha_composite(bg.convert("RGBA"), ov_p).convert("RGB")

    return bg

# ─── Intro title card ─────────────────────────────────────────────────────
def render_intro(f, total_f=60):
    t = f / total_f
    # Dark warm background
    canvas = Image.new("RGB",(W,H),(12,18,35))
    canvas = add_bokeh(canvas, [(180,140,50),(100,80,160),(80,160,120)],
                       t*4, seed=111)
    draw = ImageDraw.Draw(canvas)

    # Logo mark
    if t > 0.1:
        lt = ease_out((t-0.1)/0.5)
        cx,cy = W//2, H//2-90
        s = int(lt*100)
        if s>5:
            RED = (232,69,60)
            pts_a = [(cx-s,cy+s),(cx-int(s*.1),cy-s),(cx+int(s*.15),cy+int(s*.1))]
            pts_b = [(cx+int(s*.05),cy-int(s*.3)),(cx+int(s*.85),cy-s),(cx+int(s*.85),cy+int(s*.2))]
            draw.polygon(pts_a, fill=RED)
            draw.polygon(pts_b, fill=RED)
            draw.rectangle([cx+int(s*.15),cy+int(s*.35),cx+int(s*.85),cy+s], fill=RED)

    if t > 0.35:
        nt = ease_out((t-0.35)/0.4)
        fn1 = fnt(72)
        draw.text((W//2-330, H//2+30), "SHORTHILLS", font=fn1,
                  fill=(255,255,255,int(nt*255)))
        draw.text((W//2+240, H//2+30), " AI", font=fn1,
                  fill=(232,69,60,int(nt*255)))
    if t > 0.6:
        nt2 = ease_out((t-0.6)/0.35)
        fn2 = fnt(30, bold=False)
        txt = "SALES TEAM · MEET THE CHAMPIONS"
        bbox = fn2.getbbox(txt); tw=bbox[2]-bbox[0]
        draw.text(((W-tw)//2, H//2+120), txt, font=fn2,
                  fill=(220,200,160,int(nt2*200)))
        lw = int(lerp(0, 460, nt2))
        draw.line([((W-460)//2,(H//2+115)),((W-460)//2+lw,(H//2+115))],
                  fill=(232,69,60,200), width=3)
    return canvas

# ─── Outro ────────────────────────────────────────────────────────────────
def render_outro(f, total_f=60):
    t = f/total_f
    canvas = Image.new("RGB",(W,H),(8,14,28))
    canvas = add_bokeh(canvas, [(232,69,60),(180,140,50),(100,160,220)], t*5, 999)
    draw = ImageDraw.Draw(canvas)

    if t > 0.1:
        nt = ease_out((t-0.1)/0.5)
        fn1 = fnt(54)
        txt = "ONE TEAM. ONE MISSION. LIMITLESS POSSIBILITIES!"
        bbox = fn1.getbbox(txt); tw=bbox[2]-bbox[0]
        draw.text(((W-tw)//2, H//2-60), txt, font=fn1,
                  fill=(255,255,255,int(nt*255)))
    if t > 0.45:
        nt2 = ease_out((t-0.45)/0.4)
        fn2 = fnt(34, bold=False)
        txt2 = "Shorthills AI Sales Team — 2026"
        bbox2 = fn2.getbbox(txt2); tw2=bbox2[2]-bbox2[0]
        draw.text(((W-tw2)//2, H//2+40), txt2, font=fn2,
                  fill=(232,69,60,int(nt2*230)))
    if t > 0.72:
        nt3 = ease_out((t-0.72)/0.25)
        fn3 = fnt(26, bold=False)
        txt3 = "We Don't Just Sell. We Transform."
        bbox3 = fn3.getbbox(txt3); tw3=bbox3[2]-bbox3[0]
        draw.text(((W-tw3)//2, H//2+100), txt3, font=fn3,
                  fill=(200,180,240,int(nt3*180)))

    # Fade to black at end
    if t > 0.85:
        ft = (t-0.85)/0.15
        draw.rectangle([0,0,W,H], fill=(0,0,0,int(ft*255)))
    return canvas

# ─── Cross-dissolve ───────────────────────────────────────────────────────
def dissolve(a, b, alpha):
    aa = np.array(a, np.float32)
    bb = np.array(b, np.float32)
    return Image.fromarray(np.clip(aa*(1-alpha)+bb*alpha,0,255).astype(np.uint8))

DISSOLVE_F = 12

def get_frame(f):
    # Timeline
    INTRO_F = 60
    MEMBER_F = 150  # per member
    OUTRO_F  = 60
    # total: 60 + 9*150 + 60 = 1470 = 49s

    if f < INTRO_F - DISSOLVE_F:
        return render_intro(f, INTRO_F)
    if f < INTRO_F:
        a = (f - (INTRO_F-DISSOLVE_F)) / DISSOLVE_F
        return dissolve(render_intro(f, INTRO_F),
                        render_member_card(TEAM[0], 0, MEMBER_F), a)

    # Member segments
    seg = f - INTRO_F
    for mi, member in enumerate(TEAM):
        start = mi * MEMBER_F
        end   = start + MEMBER_F
        if seg < end - DISSOLVE_F:
            return render_member_card(member, seg-start, MEMBER_F)
        if seg < end:
            a = (seg - (end-DISSOLVE_F)) / DISSOLVE_F
            next_frame = (render_member_card(TEAM[mi+1], 0, MEMBER_F)
                          if mi+1 < len(TEAM) else render_outro(0, OUTRO_F))
            return dissolve(render_member_card(member, seg-start, MEMBER_F),
                            next_frame, a)

    # Outro
    outro_start = len(TEAM)*MEMBER_F
    of = seg - outro_start
    if of < OUTRO_F:
        return render_outro(of, OUTRO_F)
    return render_outro(OUTRO_F-1, OUTRO_F)

TOTAL_FRAMES = 60 + len(TEAM)*150 + 60  # 1470

# ─── Render ───────────────────────────────────────────────────────────────
def render():
    os.makedirs("visora_output/videos", exist_ok=True)
    silent_path = "visora_output/videos/ghibli_team_intro_silent.mp4"
    final_path  = "visora_output/videos/shorthills_ghibli_team_intro.mp4"

    writer = imageio.get_writer(
        silent_path, fps=FPS,
        codec='libx264', quality=8,
        ffmpeg_log_level='error',
        ffmpeg_params=['-preset','fast','-pix_fmt','yuv420p'],
        macro_block_size=None,
    )
    prev_pct = -1
    for f in range(TOTAL_FRAMES):
        frame = get_frame(f)
        writer.append_data(np.array(frame))
        pct = int(f/TOTAL_FRAMES*100)
        if pct%5==0 and pct!=prev_pct:
            print(f"  {pct}%", end="  ", flush=True); prev_pct=pct
    writer.close()
    print("\nSilent done.")

    # Mux rock audio
    audio = "visora_cache/rock_track.wav"
    if os.path.exists(audio):
        subprocess.run([FFMPEG,'-y','-i',silent_path,'-i',audio,
                        '-c:v','copy','-c:a','aac','-b:a','192k','-shortest',
                        final_path], check=True, capture_output=True)
    else:
        import shutil; shutil.copy(silent_path, final_path)

    mb = os.path.getsize(final_path)/1e6
    dur = TOTAL_FRAMES/FPS
    print(f"✓ {final_path}  ({mb:.1f} MB, {dur:.0f}s)")

if __name__=="__main__":
    print(f"Rendering Ghibli-style team intro  {W}×{H} @ {FPS}fps  "
          f"{TOTAL_FRAMES} frames ({TOTAL_FRAMES/FPS:.0f}s)...")
    render()
