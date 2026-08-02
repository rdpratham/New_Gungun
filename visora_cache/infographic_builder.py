"""
VISORA — Shorthills AI Team Infographic
Brand theme: Red #E8453C + Black #111111 + White — matching logo
2560x1440 landscape
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
from pathlib import Path
import math, random

W, H = 2560, 1440

# ══════════════════════════════════════
# SHORTHILLS AI BRAND PALETTE
# ══════════════════════════════════════
RED       = (232, 69,  60)    # #E8453C — primary brand red
RED2      = (255, 100, 90)    # lighter red for highlights
RED_DARK  = (160, 30,  25)    # deep red for shadows
BLACK     = (14,  14,  14)    # near-black bg
BLACK2    = (24,  24,  24)    # card bg
BLACK3    = (38,  38,  38)    # lighter card bg
WHITE     = (255, 255, 255)
OFF_WHITE = (235, 235, 235)
LGRAY     = (160, 160, 165)

# Per-member card accent colors — all in red/black/white family
CARD_THEMES = {
    'pratham':  (BLACK2, (50,50,50), RED,     WHITE),   # bg, border, accent, text
    'dhruv':    (BLACK2, (50,50,50), RED_DARK, WHITE),
    'sameer':   ((28,28,30),(55,55,60), (200,200,200), BLACK),
    'tejaswi':  (RED_DARK, RED, (255,220,0), WHITE),
    'arsh':     ((30,20,15),(80,50,30), (200,140,60), WHITE),
    'kashish':  ((35,20,30),(90,40,70), (220,100,150), WHITE),
    'ayush':    (BLACK2, RED, RED, WHITE),
    'aryan':    (RED_DARK, RED, WHITE, BLACK),
    'himanshu': ((15,30,25),(40,90,65), (60,200,130), WHITE),
}

def fnt(size, bold=True):
    for p in [
        f"/usr/share/fonts/truetype/liberation/LiberationSans-{'Bold' if bold else 'Regular'}.ttf",
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf",
    ]:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def centered(draw, text, cx, y, f, color, shadow_col=(0,0,0,100)):
    bb = draw.textbbox((0,0), text, font=f)
    tw = bb[2]-bb[0]
    x = cx - tw//2
    draw.text((x+2,y+2), text, font=f, fill=shadow_col)
    draw.text((x,y), text, font=f, fill=color)
    return tw

def wrap_lines(draw, text, max_w, f):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur+" "+w).strip()
        bb = draw.textbbox((0,0), test, font=f)
        if bb[2]-bb[0] > max_w and cur:
            lines.append(cur); cur = w
        else: cur = test
    if cur: lines.append(cur)
    return lines

def star(draw, cx, cy, r, color, points=5):
    pts = []
    for i in range(points*2):
        angle = math.pi/2 + i*math.pi/points
        ri = r if i%2==0 else r*0.42
        pts.append((cx+ri*math.cos(angle), cy+ri*math.sin(angle)))
    draw.polygon(pts, fill=color)

def draw_logo_shape(draw, cx, cy, size, alpha=255):
    """Draw Shorthills AI logo mark (A + i shapes in red)"""
    # Left triangle (A left stroke)
    s = size
    pts_a = [(cx-s, cy+s), (cx-s*0.1, cy-s), (cx+s*0.15, cy+s*0.1)]
    draw.polygon(pts_a, fill=(*RED, alpha))
    # Right triangle (A right stroke / i dot)
    pts_b = [(cx+s*0.05, cy-s*0.3), (cx+s*0.85, cy-s), (cx+s*0.85, cy+s*0.2)]
    draw.polygon(pts_b, fill=(*RED, alpha))
    # i bar
    draw.rectangle([cx+s*0.15, cy+s*0.35, cx+s*0.85, cy+s], fill=(*RED, alpha))

def speech_bubble(draw, canvas, text, x, y, max_w, f, bg, fg, border=RED, tail='bottom'):
    lines = wrap_lines(draw, text, max_w, f)
    lh = int(draw.textbbox((0,0),"A",font=f)[3]*1.4)
    pad = 14
    bh = len(lines)*lh + pad*2
    bw = max_w + pad*2
    layer = Image.new("RGBA", canvas.size, (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([x,y,x+bw,y+bh], radius=12, fill=(*bg,230))
    ld.rounded_rectangle([x,y,x+bw,y+bh], radius=12, outline=(*border,200), width=2)
    if tail == 'bottom':
        ld.polygon([(x+bw//2-10,y+bh),(x+bw//2,y+bh+16),(x+bw//2+10,y+bh)], fill=(*bg,230))
    elif tail == 'left':
        ld.polygon([(x,y+bh//2-8),(x-16,y+bh//2),(x,y+bh//2+8)], fill=(*bg,230))
    elif tail == 'right':
        ld.polygon([(x+bw,y+bh//2-8),(x+bw+16,y+bh//2),(x+bw,y+bh//2+8)], fill=(*bg,230))
    elif tail == 'top':
        ld.polygon([(x+bw//2-10,y),(x+bw//2,y-16),(x+bw//2+10,y)], fill=(*bg,230))
    for i, ln in enumerate(lines):
        ld.text((x+pad, y+pad+i*lh), ln, font=f, fill=(*fg,240))
    return Image.alpha_composite(canvas.convert("RGBA"), layer).convert("RGB"), bw, bh

def photo_circle(canvas, cx, cy, r, initials, photo_path=None,
                 bg1=BLACK2, bg2=BLACK3, border=RED):
    layer = Image.new("RGBA", canvas.size, (0,0,0,0))
    ld = ImageDraw.Draw(layer)
    if photo_path and Path(photo_path).exists():
        try:
            photo = Image.open(photo_path).convert("RGB")
            pw, ph = photo.size
            side = min(pw, ph)
            photo = photo.crop(((pw-side)//2,(ph-side)//2,(pw+side)//2,(ph+side)//2))
            photo = photo.resize((r*2,r*2), Image.LANCZOS)
            mask = Image.new("L",(r*2,r*2),0)
            ImageDraw.Draw(mask).ellipse([0,0,r*2,r*2],fill=255)
            tmp = canvas.copy()
            tmp.paste(photo,(cx-r,cy-r),mask)
            for rr in range(6,0,-1):
                ld.ellipse([cx-r-rr,cy-r-rr,cx+r+rr,cy+r+rr],
                           outline=(*border,int(240*(1-rr/7))),width=2)
            result = Image.alpha_composite(tmp.convert("RGBA"), layer).convert("RGB")
            return result
        except: pass
    # Placeholder
    for rr in range(r,0,-2):
        t = 1-rr/r
        col = tuple(int(bg1[i]+(bg2[i]-bg1[i])*t) for i in range(3))
        ld.ellipse([cx-rr,cy-rr,cx+rr,cy+rr], fill=(*col,230))
    fi = fnt(int(r*0.55))
    bb = ld.textbbox((0,0),initials,font=fi)
    ld.text((cx-(bb[2]-bb[0])//2, cy-(bb[3]-bb[1])//2-5), initials, font=fi, fill=(*border,240))
    for rr in range(6,0,-1):
        ld.ellipse([cx-r-rr,cy-r-rr,cx+r+rr,cy+r+rr],
                   outline=(*border,int(240*(1-rr/7))),width=2)
    return Image.alpha_composite(canvas.convert("RGBA"), layer).convert("RGB")


# ══════════════════════════════════════════════════════════
# MAIN BUILD
# ══════════════════════════════════════════════════════════
def build():
    canvas = Image.new("RGB", (W,H), BLACK)
    draw = ImageDraw.Draw(canvas)

    # ── Background: subtle texture + red corner glows ──
    arr = np.array(canvas).astype(np.float32)
    # Diagonal light sweep from top-left
    for y in range(H):
        for step in range(0, W, 4):
            t = (step/W + y/H*0.3) % 1.0
            arr[y, step:step+4] = [int(14+8*t), int(14+6*t), int(14+5*t)]
    canvas = Image.fromarray(arr.astype(np.uint8))
    draw = ImageDraw.Draw(canvas)

    # Red corner glow - top left
    glow = Image.new("RGBA",(W,H),(0,0,0,0))
    gd = ImageDraw.Draw(glow)
    for r in range(400,0,-30):
        gd.ellipse([-r,- r,r,r], fill=(*RED_DARK, int(22*(1-r/400))))
    # Bottom right glow
    for r in range(300,0,-30):
        gd.ellipse([W-r,H-r,W+r,H+r], fill=(*RED_DARK, int(18*(1-r/300))))
    canvas = Image.alpha_composite(canvas.convert("RGBA"),
                                   glow.filter(ImageFilter.GaussianBlur(40))).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    # ── TOP HEADER BAR ──
    draw.rectangle([(0,0),(W,90)], fill=BLACK)
    draw.rectangle([(0,88),(W,95)], fill=RED)  # red underline

    # Logo mark left
    logo_layer = Image.new("RGBA",(W,H),(0,0,0,0))
    lld = ImageDraw.Draw(logo_layer)
    draw_logo_shape(lld, 60, 44, 28)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), logo_layer).convert("RGB")
    draw = ImageDraw.Draw(canvas)
    draw.text((102, 14), "Shorthills", font=fnt(46), fill=WHITE)
    draw.text((102+fnt(46).getlength("Shorthills"), 14), " AI", font=fnt(46), fill=RED)

    # Main title centered
    ft = fnt(62)
    parts = [("ONE TEAM. ", WHITE), ("ONE CAPTAIN. ", RED2), ("LIMITLESS POSSIBILITIES!", WHITE)]
    total_w = sum(draw.textbbox((0,0),p,font=ft)[2]-draw.textbbox((0,0),p,font=ft)[0] for p,_ in parts)
    cur_x = W//2 - total_w//2
    for pt, pc in parts:
        draw.text((cur_x+2, 14), pt, font=ft, fill=(0,0,0,80))
        draw.text((cur_x, 13), pt, font=ft, fill=pc)
        bb = draw.textbbox((0,0), pt, font=ft)
        cur_x += bb[2]-bb[0]

    # Subtitle
    fsb = fnt(30, bold=False)
    sub = "Different Minds. One Captain. Infinite Impact."
    bb_s = draw.textbbox((0,0), sub, font=fsb)
    draw.text((W//2-(bb_s[2]-bb_s[0])//2, 54), sub, font=fsb, fill=(*LGRAY,230))

    # Logo mark right
    ll2 = Image.new("RGBA",(W,H),(0,0,0,0))
    ll2d = ImageDraw.Draw(ll2)
    draw_logo_shape(ll2d, W-92, 44, 28)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), ll2).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    # ── BOTTOM BANNER ──
    draw.rectangle([(0,H-68),(W,H)], fill=BLACK)
    draw.rectangle([(0,H-72),(W,H-68)], fill=RED)
    fbot = fnt(36)
    bot = "★  ONE VISION. ONE TEAM. ENDLESS IMPACT.  ★     We don't just work together, we WIN together!  🚀"
    bb_bot = draw.textbbox((0,0), bot, font=fbot)
    bw_bot = bb_bot[2]-bb_bot[0]
    # Scrolling marquee style - truncate to fit
    draw.text((W//2-min(bw_bot,W-40)//2, H-56), bot[:int(len(bot)*W/max(bw_bot,1))+10],
              font=fbot, fill=WHITE)

    # ════════════════════════════════════
    # LAYOUT GEOMETRY
    # ════════════════════════════════════
    TOP_Y = 100
    BOT_Y = H - 75
    CONTENT_H = BOT_Y - TOP_Y

    LEFT_W   = 480     # left column (Pratham, Dhruv)
    RIGHT_W  = 480     # right column (4 stacked cards)
    CENTER_X = LEFT_W + 8
    CENTER_W = W - LEFT_W - RIGHT_W - 16
    CENTER_H = int(CONTENT_H * 0.62)
    BOTTOM_H = CONTENT_H - CENTER_H - 10

    # ════════════════════════════════════
    # MEMBER CARD HELPER
    # ════════════════════════════════════
    def member_card(x, y, w, h, key, name, subtitle, quote, banner, initials,
                    photo_r=80, compact=False):
        bg, border_col, accent, txt_col = CARD_THEMES.get(key,(BLACK2,(60,60,60),RED,WHITE))

        # Card body
        cl = Image.new("RGBA",(W,H),(0,0,0,0))
        cd = ImageDraw.Draw(cl)
        # Gradient fill
        for ry in range(h):
            t_r = ry/h
            dark_factor = 1 - t_r*0.25
            col = tuple(int(bg[i]*dark_factor) for i in range(3))
            cd.rectangle([x,y+ry,x+w,y+ry+1], fill=(*col,238))
        cd.rounded_rectangle([x,y,x+w,y+h], radius=16, outline=(*border_col,255), width=3)
        # Accent top strip
        strip_h = 42 if not compact else 34
        cd.rounded_rectangle([x+2,y+2,x+w-2,y+strip_h], radius=14, fill=(*accent,230))
        nonlocal canvas
        canvas = Image.alpha_composite(canvas.convert("RGBA"), cl).convert("RGB")
        d2 = ImageDraw.Draw(canvas)

        # Name in accent strip
        fn2 = fnt(30 if not compact else 24)
        bb_n = d2.textbbox((0,0), name, font=fn2)
        nw = bb_n[2]-bb_n[0]
        nx = x+w//2-nw//2
        d2.text((nx+1,y+7), name, font=fn2, fill=(0,0,0,120))
        d2.text((nx,y+6), name, font=fn2, fill=txt_col)

        # Subtitle tag
        fs2 = fnt(18 if not compact else 16, bold=False)
        bb_s2 = d2.textbbox((0,0), subtitle, font=fs2)
        sw = bb_s2[2]-bb_s2[0]
        tag_y = y+strip_h+4
        d2.rounded_rectangle([x+w//2-sw//2-8,tag_y,x+w//2+sw//2+8,tag_y+24],
                              radius=6, fill=(*BLACK,200))
        d2.text((x+w//2-sw//2, tag_y+3), subtitle, font=fs2, fill=(*accent,240))

        # Photo
        ph_cy = tag_y + 28 + photo_r
        ph_cx = x + w//2
        canvas = photo_circle(canvas, ph_cx, ph_cy, photo_r,
                               initials, f"visora_assets/{key}.jpg",
                               bg1=bg, bg2=border_col, border=accent)
        d2 = ImageDraw.Draw(canvas)

        # Quote
        q_y = ph_cy + photo_r + 10
        fq = fnt(17 if not compact else 15, bold=False)
        q_lines = wrap_lines(d2, quote, w-40, fq)
        lhq = 24
        qh = len(q_lines)*lhq + 16
        d2.rounded_rectangle([x+10,q_y,x+w-10,q_y+qh], radius=8, fill=(*BLACK,210))
        d2.rounded_rectangle([x+10,q_y,x+w-10,q_y+qh], radius=8, outline=(*accent,120), width=1)
        # Quote mark
        d2.text((x+14, q_y-2), "“", font=fnt(28), fill=(*accent,160))
        for i, ql in enumerate(q_lines):
            d2.text((x+18, q_y+8+i*lhq), ql, font=fq, fill=(*OFF_WHITE,230))

        # Bottom banner
        ban_y = y+h-40
        d2.rectangle([x+3,ban_y,x+w-3,y+h-3], fill=(*accent,220))
        fbn = fnt(19 if not compact else 17)
        bb_bn = d2.textbbox((0,0), banner, font=fbn)
        bw_b = bb_bn[2]-bb_bn[0]
        d2.text((x+w//2-bw_b//2, ban_y+5), banner, font=fbn, fill=txt_col)

    # ════════════════════════════════════
    # LEFT COLUMN: Pratham (top) + Dhruv (bottom)
    # ════════════════════════════════════
    half_h = (CENTER_H-8)//2
    member_card(6, TOP_Y, LEFT_W-6, half_h, 'pratham',
                "PRATHAM", "Chattur – Intelligent",
                "Dimag computer se tez, jugaad Top Class!",
                "Brains + Strategy = Pratham", "PR", photo_r=82)

    member_card(6, TOP_Y+half_h+8, LEFT_W-6, half_h, 'dhruv',
                "DHRUV", "Skoda – Smart & Clever",
                "Simple look, Smart & Clever mind!",
                "Keep It Smart. Keep It Clever.", "DH", photo_r=72)

    # ════════════════════════════════════
    # RIGHT COLUMN: 4 stacked cards
    # ════════════════════════════════════
    rx = W - RIGHT_W + 4
    qtr_h = (CENTER_H-12)//4
    for ri, (rkey, rname, rsub, rquote, rban, rinit) in enumerate([
        ('sameer','SAMEER','Always Alone',
         'Log apne group me busy, Sameer apne thoughts me busy.',
         'No Group. No Problem.','SM'),
        ('tejaswi','TEJASWI','Gabbar',
         'Pehle khana, phir kaam!',
         'Master Chef of the Team!','TJ'),
        ('arsh','ARSH','Real Estate Agent',
         'Deal pakki, commission pakka!',
         'Ghar, Plot, Office - Arsh Sab Jod De!','AR'),
        ('kashish','KASHISH','Mentally Lost Girl',
         'Na idhar ki, na udhar ki... kuch samajh nahi aaya.',
         'Still Loading... Please Wait','KS'),
    ]):
        member_card(rx, TOP_Y+ri*(qtr_h+4), RIGHT_W-8, qtr_h,
                    rkey, rname, rsub, rquote, rban, rinit, photo_r=52, compact=True)

    # ════════════════════════════════════
    # CENTER: AYUSH GRACK
    # ════════════════════════════════════
    cx0 = CENTER_X
    cw = CENTER_W
    cy0 = TOP_Y

    # Center card bg
    cl_c = Image.new("RGBA",(W,H),(0,0,0,0))
    cd_c = ImageDraw.Draw(cl_c)
    for ry in range(CENTER_H):
        t = ry/CENTER_H
        col = (int(18+10*t), int(18+8*t), int(18+6*t))
        cd_c.rectangle([cx0,cy0+ry,cx0+cw,cy0+ry+1], fill=(*col,245))
    cd_c.rounded_rectangle([cx0,cy0,cx0+cw,cy0+CENTER_H], radius=22,
                            outline=(*RED,255), width=4)
    # Red top bar
    cd_c.rectangle([cx0+4,cy0+4,cx0+cw-4,cy0+58], fill=(*RED,240))
    cd_c.rounded_rectangle([cx0,cy0,cx0+cw,cy0+58], radius=18, outline=(*RED,255), width=3)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), cl_c).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    # "THE MANAGER & STRATEGIST"
    fmgr = fnt(26)
    mgr = "THE MANAGER & STRATEGIST"
    bb_mgr = draw.textbbox((0,0), mgr, font=fmgr)
    draw.text((cx0+cw//2-(bb_mgr[2]-bb_mgr[0])//2, cy0+10), mgr, font=fmgr, fill=WHITE)

    # "AYUSH GRACK" huge
    fay = fnt(74)
    ay_txt = "AYUSH GRACK"
    bb_ay = draw.textbbox((0,0), ay_txt, font=fay)
    aw = bb_ay[2]-bb_ay[0]
    draw.text((cx0+cw//2-aw//2+2, cy0+62), ay_txt, font=fay, fill=(0,0,0,90))
    draw.text((cx0+cw//2-aw//2, cy0+60), ay_txt, font=fay, fill=WHITE)

    # Red underline accent
    draw.rectangle([cx0+cw//2-aw//2, cy0+144, cx0+cw//2+aw//2, cy0+150], fill=RED)

    # Stars
    for sx in [cx0+50, cx0+cw-50]:
        star(draw, sx, cy0+95, 18, RED)

    # Tagline
    ftag = fnt(28, bold=False)
    tag = "The Glue.  The Guide.  The Game Changer."
    bb_t = draw.textbbox((0,0), tag, font=ftag)
    draw.text((cx0+cw//2-(bb_t[2]-bb_t[0])//2, cy0+158), tag, font=ftag, fill=(*RED2,240))

    # Crown
    cc = cx0+cw//2; ccy = cy0+185
    cpts = [(cc-38,ccy+35),(cc-50,ccy),(cc-20,ccy+20),(cc,ccy-14),
            (cc+20,ccy+20),(cc+50,ccy),(cc+38,ccy+35)]
    draw.polygon(cpts, fill=RED)
    draw.polygon(cpts, outline=RED2, width=2)
    draw.ellipse([cc-8,ccy-8,cc+8,ccy+8], fill=WHITE)

    # Ayush photo
    ay_r = 128
    ay_cy = cy0 + 188 + ay_r
    ay_cx = cx0 + cw//2
    canvas = photo_circle(canvas, ay_cx, ay_cy, ay_r, "AG",
                          "visora_assets/ayush.jpg",
                          bg1=BLACK2, bg2=BLACK3, border=RED)
    draw = ImageDraw.Draw(canvas)

    # Speech bubbles
    fspb = fnt(19, bold=False)
    canvas, _, _ = speech_bubble(draw, canvas,
        '"I don\'t just manage people, I unlock their superpowers and multiply their impact."',
        cx0+14, cy0+260, 238, fspb, bg=BLACK2, fg=WHITE, border=RED, tail='right')
    draw = ImageDraw.Draw(canvas)
    canvas, _, _ = speech_bubble(draw, canvas,
        '"I see the big picture, plan the strategy, and give my team the freedom to win!"',
        cx0+cw-268, cy0+260, 238, fspb, bg=BLACK2, fg=WHITE, border=RED, tail='left')
    draw = ImageDraw.Draw(canvas)

    # Superpowers section
    sp_y = ay_cy + ay_r + 18
    draw.rectangle([cx0+8,sp_y-4,cx0+cw-8,sp_y+115], fill=(20,20,20,230))
    draw.rectangle([cx0+8,sp_y-4,cx0+cw-8,sp_y+38], fill=(*RED,240))
    fsp = fnt(24)
    centered(draw, "AYUSH'S SUPERPOWERS", cx0+cw//2, sp_y+2, fsp, WHITE, shadow_col=(0,0,0,100))
    powers = ["Strategic\nThinker","Problem\nSolver","People\nDeveloper",
              "Chaos\nController","Vision\nMaster","Results\nDriven"]
    pw_sp = (cw-28)//len(powers)
    fpw = fnt(17)
    for pi, pw in enumerate(powers):
        px2 = cx0+16+pi*pw_sp
        draw.rounded_rectangle([px2,sp_y+42,px2+pw_sp-6,sp_y+114],
                                radius=6, fill=(30,30,30,220))
        draw.rounded_rectangle([px2,sp_y+42,px2+pw_sp-6,sp_y+114],
                                radius=6, outline=(*RED,100), width=1)
        for li, lp in enumerate(pw.split('\n')):
            bb_pw = draw.textbbox((0,0), lp, font=fpw)
            draw.text((px2+(pw_sp-(bb_pw[2]-bb_pw[0]))//2, sp_y+50+li*28), lp,
                      font=fpw, fill=(*OFF_WHITE,230))

    # Team says section
    wts_y = sp_y + 120
    draw.rectangle([cx0+8,wts_y,cx0+cw-8,wts_y+130], fill=(18,18,18,230))
    fwts = fnt(22)
    centered(draw, "WHAT MY TEAM SAYS ABOUT ME", cx0+cw//2, wts_y+6, fwts, WHITE)
    says = ["Trusts\nUs 100%","Gives Clarity\n& Direction","Always\nSupports",
            "Pushes Us\nTo Grow","Calm In\nThe Chaos"]
    ts_sp = (cw-28)//len(says)
    fts = fnt(16)
    for ti, ts_txt in enumerate(says):
        tsx = cx0+16+ti*ts_sp
        tsy2 = wts_y+34
        draw.rounded_rectangle([tsx,tsy2,tsx+ts_sp-6,tsy2+88], radius=6, fill=(28,28,28,220))
        draw.rounded_rectangle([tsx,tsy2,tsx+ts_sp-6,tsy2+88], radius=6, outline=(*RED,80), width=1)
        for li2, lt in enumerate(ts_txt.split('\n')):
            bb_ts = draw.textbbox((0,0), lt, font=fts)
            draw.text((tsx+(ts_sp-(bb_ts[2]-bb_ts[0]))//2, tsy2+10+li2*30),
                      lt, font=fts, fill=(*RED2,240))

    # ════════════════════════════════════
    # BOTTOM ROW
    # ════════════════════════════════════
    BY = TOP_Y + CENTER_H + 8
    BH = CONTENT_H - CENTER_H - 8
    third = W // 3

    # Left: Dream Team label
    cl_b = Image.new("RGBA",(W,H),(0,0,0,0))
    cd_b = ImageDraw.Draw(cl_b)
    cd_b.rounded_rectangle([8,BY,third-8,BY+BH-8], radius=16, fill=(16,16,16,235))
    cd_b.rounded_rectangle([8,BY,third-8,BY+BH-8], radius=16, outline=(*RED,200), width=2)
    cd_b.rectangle([10,BY+2,third-10,BY+50], fill=(*RED,230))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), cl_b).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    fdm = fnt(30); centered(draw, "THE DREAM TEAM", third//2, BY+8, fdm, WHITE)
    fdm2 = fnt(22); centered(draw, "SUPPORTING THE VISION!", third//2, BY+56, fdm2, RED2)

    # Aryan sub-section in left panel
    ary_photo_r = 75
    canvas = photo_circle(canvas, third//4, BY+BH//2, ary_photo_r, "AK",
                          "visora_assets/aryan.jpg", bg1=(40,10,10), bg2=RED_DARK, border=RED)
    draw = ImageDraw.Draw(canvas)

    fa1 = fnt(26); draw.text((third//2-10, BY+90), "ARYAN KUSHWAHA", font=fa1, fill=WHITE)
    fa2 = fnt(18, bold=False)
    for bi, bt_txt in enumerate(['"Kuch Bhi Ho, Bech Denge!" 😎',
                                   "Technology engineer se zyada aati hai.",
                                   "No excuses. Only Results."]):
        clr = RED2 if bi==0 else OFF_WHITE
        draw.text((third//2-10, BY+124+bi*30), bt_txt, font=fa2,
                  fill=(*clr, 220))

    draw.rounded_rectangle([third//2-12, BY+BH-52, third-16, BY+BH-12],
                            radius=8, fill=(*RED,220))
    frib = fnt(20)
    centered(draw, "Sales is Not a Job, It's My Game!", third*3//4, BY+BH-40, frib, WHITE)

    # Center: Handshake / mission connector
    cx2 = third; cw2 = third
    cl_c2 = Image.new("RGBA",(W,H),(0,0,0,0))
    cd_c2 = ImageDraw.Draw(cl_c2)
    cd_c2.rounded_rectangle([cx2+4,BY,cx2+cw2-4,BY+BH-8], radius=16, fill=(14,14,14,240))
    cd_c2.rounded_rectangle([cx2+4,BY,cx2+cw2-4,BY+BH-8], radius=16, outline=(*RED,220), width=3)
    canvas = Image.alpha_composite(canvas.convert("RGBA"), cl_c2).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    fc1 = fnt(28)
    centered(draw, "TOGETHER, WE EMPOWER THE VISION!", cx2+cw2//2, BY+10, fc1, WHITE)
    draw.rectangle([cx2+20,BY+50,cx2+cw2-20,BY+54], fill=RED)

    # Backed by best box
    draw.rounded_rectangle([cx2+25,BY+62,cx2+cw2-25,BY+145],
                            radius=10, fill=(22,22,22,230))
    draw.rounded_rectangle([cx2+25,BY+62,cx2+cw2-25,BY+145],
                            radius=10, outline=(*RED,150), width=2)
    centered(draw, "BACKED BY THE BEST.", cx2+cw2//2, BY+70, fnt(26), RED)
    centered(draw, "DRIVEN BY THE MISSION.", cx2+cw2//2, BY+106, fnt(26), WHITE)

    # Handshake glow
    hcx = cx2+cw2//2; hcy = BY+190
    glow2 = Image.new("RGBA",(W,H),(0,0,0,0))
    g2d = ImageDraw.Draw(glow2)
    for rr in range(55,0,-7): g2d.ellipse([hcx-rr,hcy-rr,hcx+rr,hcy+rr],
                                            fill=(*RED,int(55*(1-rr/55))))
    canvas = Image.alpha_composite(canvas.convert("RGBA"),
                                   glow2.filter(ImageFilter.GaussianBlur(12))).convert("RGB")
    draw = ImageDraw.Draw(canvas)
    draw.ellipse([hcx-28,hcy-28,hcx+28,hcy+28], fill=RED)
    draw.text((hcx-18,hcy-20), "🤝", font=fnt(32), fill=WHITE)

    # Pipeline icons
    icons = ["Strategy","Support","Execution","Closure"]
    ic_sp = (cw2-40)//len(icons)
    fic = fnt(17)
    for ii, ic in enumerate(icons):
        icx = cx2+22+ii*ic_sp
        icy = BY+BH-65
        draw.rounded_rectangle([icx,icy,icx+ic_sp-6,icy+48], radius=6, fill=(24,24,24,230))
        draw.rounded_rectangle([icx,icy,icx+ic_sp-6,icy+48], radius=6, outline=(*RED,100), width=1)
        bb_ic = draw.textbbox((0,0), ic, font=fic)
        draw.text((icx+(ic_sp-(bb_ic[2]-bb_ic[0]))//2, icy+14), ic, font=fic, fill=(*RED2,230))

    # Right: Himanshu
    hx2 = third*2; hw2 = W-hx2-8
    cl_him = Image.new("RGBA",(W,H),(0,0,0,0))
    ch = ImageDraw.Draw(cl_him)
    ch.rounded_rectangle([hx2+4,BY,hx2+hw2,BY+BH-8], radius=16, fill=(14,14,14,240))
    ch.rounded_rectangle([hx2+4,BY,hx2+hw2,BY+BH-8], radius=16, outline=(*RED,200), width=2)
    ch.rectangle([hx2+6,BY+2,hx2+hw2-2,BY+50], fill=(*RED,230))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), cl_him).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    fh1 = fnt(28); centered(draw, "HIMANSHU YADAV", hx2+hw2//2, BY+8, fh1, WHITE)
    fh2 = fnt(19, bold=False)
    centered(draw, "Professional. Serious. Silent Killer.", hx2+hw2//2, BY+52, fh2, RED2)

    him_photo_r = 75
    canvas = photo_circle(canvas, hx2+hw2//4, BY+BH//2, him_photo_r, "HY",
                          "visora_assets/himanshu.jpg",
                          bg1=(10,30,20), bg2=(30,80,55), border=(60,200,130))
    draw = ImageDraw.Draw(canvas)

    fhb = fnt(18, bold=False)
    for bi2, ht in enumerate(["Databricks, AWS, GCP, Microsoft,",
                                "Snowflake – sbki partnership sambhal lega.",
                                "Re tera Head of Partnership.",
                                "Lifescience? I will add!"]):
        clrh = WHITE if bi2<3 else RED2
        draw.text((hx2+hw2//2, BY+90+bi2*30), ht, font=fhb, fill=(*clrh,220))

    draw.rounded_rectangle([hx2+hw2//2-10, BY+BH-52, hx2+hw2-12, BY+BH-12],
                            radius=8, fill=(40,200,120,220))
    fmis = fnt(18)
    centered(draw, "MISSION: LIFESCIENCE & BEYOND!", hx2+hw2*3//4, BY+BH-40, fmis, BLACK)

    # ── Final sparkle pass ──
    spl = Image.new("RGBA",(W,H),(0,0,0,0))
    spd = ImageDraw.Draw(spl)
    random.seed(7)
    for _ in range(150):
        px4 = random.randint(0,W)
        py4 = random.randint(0,H)
        sz4 = random.randint(1,3)
        a4 = random.randint(20,80)
        color4 = RED if random.random()>0.5 else WHITE
        spd.ellipse([px4-sz4,py4-sz4,px4+sz4,py4+sz4], fill=(*color4,a4))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), spl).convert("RGB")

    return canvas


if __name__ == "__main__":
    Path("visora_output/photos").mkdir(parents=True, exist_ok=True)
    print("Building Shorthills AI infographic (red/black/white theme)...")
    img = build()
    out = "visora_output/photos/shorthills_team_infographic.png"
    img.save(out, "PNG")
    import os
    print(f"✓ {out}  ({os.path.getsize(out)/1024/1024:.1f} MB)  {img.size}")
    # Also save JPEG for web
    img.save("visora_output/photos/shorthills_team_infographic.jpg","JPEG",quality=95)
    print("✓ JPEG saved too")
