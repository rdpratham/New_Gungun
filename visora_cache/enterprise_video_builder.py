"""
Enterprise marketing video for Shorthills AI Sales Team.
1920×1080, 60s, H.264 + rock audio, 30fps.
Animates the infographic with cinematic motion: fly-ins, zoom punches, particles.
"""
import numpy as np, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── imageio / ffmpeg setup ──────────────────────────────────────────────────
import imageio
import imageio_ffmpeg
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

W, H = 1920, 1080
FPS  = 30
TOTAL_SECS = 62
TOTAL_FRAMES = TOTAL_SECS * FPS  # 1860

# ── Brand colors ───────────────────────────────────────────────────────────
RED    = (232, 69, 60)
RED2   = (255, 100, 80)
BLACK  = (14, 14, 14)
BLACK2 = (28, 18, 18)
WHITE  = (255, 255, 255)
GOLD   = (230, 180, 60)

# ── Font helper ─────────────────────────────────────────────────────────────
FONT_PATHS = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
def fnt(size, bold=True):
    for p in (FONT_PATHS[0] if bold else FONT_PATHS[1], FONT_PATHS[2]):
        try: return ImageFont.truetype(p, size)
        except: pass
    return ImageFont.load_default()

# ── Helper: load infographic (downscale to 1920×1080) ──────────────────────
def load_infographic():
    src = "visora_output/photos/shorthills_team_infographic.png"
    img = Image.open(src).convert("RGB")
    # Crop letterbox to 16:9
    iw, ih = img.size
    target_ratio = W / H
    src_ratio = iw / ih
    if src_ratio > target_ratio:
        new_w = int(ih * target_ratio)
        x0 = (iw - new_w) // 2
        img = img.crop((x0, 0, x0+new_w, ih))
    else:
        new_h = int(iw / target_ratio)
        y0 = (ih - new_h) // 2
        img = img.crop((0, y0, iw, y0+new_h))
    return img.resize((W, H), Image.LANCZOS)

# ── Easing ─────────────────────────────────────────────────────────────────
def ease_out(t): return 1 - (1-t)**3
def ease_in(t):  return t**3
def ease_io(t):  return 3*t**2 - 2*t**3

def lerp(a, b, t): return a + (b-a)*t

# ── Particle system ────────────────────────────────────────────────────────
class Particles:
    def __init__(self, n=80, seed=42):
        rng = np.random.default_rng(seed)
        self.x  = rng.uniform(0, W, n).astype(np.float32)
        self.y  = rng.uniform(0, H, n).astype(np.float32)
        self.vx = rng.uniform(-0.5, 0.5, n).astype(np.float32)
        self.vy = rng.uniform(-1.5, -0.3, n).astype(np.float32)
        self.r  = rng.uniform(1.5, 4.0, n).astype(np.float32)
        self.life = rng.uniform(0, 1, n).astype(np.float32)
        self.col = [RED if i%3==0 else (WHITE if i%3==1 else RED2) for i in range(n)]
        self.n  = n

    def step(self):
        self.x += self.vx
        self.y += self.vy
        self.life += 0.008
        reset = self.life > 1
        rng = np.random.default_rng(int(self.life.sum()*1000) % 99999)
        self.x[reset] = rng.uniform(0, W, reset.sum())
        self.y[reset] = rng.uniform(H*0.6, H, reset.sum())
        self.life[reset] = 0

    def draw(self, canvas):
        draw = ImageDraw.Draw(canvas)
        for i in range(self.n):
            alpha = int((1 - self.life[i]) * 180)
            r = int(self.r[i])
            x, y = int(self.x[i]), int(self.y[i])
            c = (*self.col[i], alpha)
            draw.ellipse([x-r, y-r, x+r, y+r], fill=c)
        return canvas

# ── CRT scanline overlay (subtle) ─────────────────────────────────────────
def scanlines(canvas, alpha=18):
    ov = Image.new("RGBA", (W, H), (0,0,0,0))
    dov = ImageDraw.Draw(ov)
    for y in range(0, H, 4):
        dov.line([(0,y),(W,y)], fill=(0,0,0,alpha), width=1)
    return Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")

# ── Vignette ──────────────────────────────────────────────────────────────
_vignette_cache = None
def get_vignette():
    global _vignette_cache
    if _vignette_cache is None:
        vig = Image.new("RGBA", (W, H), (0,0,0,0))
        d = ImageDraw.Draw(vig)
        steps = 30
        for i in range(steps):
            t_v = i / steps
            alpha = int(t_v**1.5 * 160)
            pad = int(t_v * min(W,H) * 0.45)
            if W - 2*pad > 4 and H - 2*pad > 4:
                d.rectangle([pad, pad, W-pad, H-pad],
                            outline=(0,0,0, alpha), width=2)
        _vignette_cache = vig
    return _vignette_cache

def apply_vignette(img):
    return Image.alpha_composite(img.convert("RGBA"), get_vignette()).convert("RGB")

# ── Frame composers ────────────────────────────────────────────────────────
particles = Particles(100)
base_infographic = None  # loaded once

def get_base():
    global base_infographic
    if base_infographic is None:
        base_infographic = load_infographic()
    return base_infographic.copy()

def zoom_crop(img, scale, cx=None, cy=None):
    """Zoom into image around (cx, cy) by scale factor."""
    if scale <= 1.0: return img
    w, h = img.size
    cx = cx or w//2; cy = cy or h//2
    nw = int(w/scale); nh = int(h/scale)
    x0 = max(0, min(cx - nw//2, w-nw))
    y0 = max(0, min(cy - nh//2, h-nh))
    return img.crop((x0, y0, x0+nw, y0+nh)).resize((W, H), Image.LANCZOS)

def red_flash(canvas, alpha):
    ov = Image.new("RGBA", (W,H), (0,0,0,0))
    ImageDraw.Draw(ov).rectangle([0,0,W,H], fill=(*RED, int(alpha*255)))
    return Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")

def motion_blur_h(img, px=8):
    """Fake horizontal motion blur via box blur asymmetric."""
    return img.filter(ImageFilter.BoxBlur(px//2))

def draw_text_shadow(draw, text, x, y, font, color, shadow_off=3, shadow_alpha=180):
    sx, sy = x+shadow_off, y+shadow_off
    draw.text((sx,sy), text, font=font, fill=(0,0,0, shadow_alpha))
    draw.text((x,y), text, font=font, fill=color)

# ── Scene definitions ──────────────────────────────────────────────────────
# Timeline (at 30fps):
# 0-90    : Scene 1 — Black screen → Logo punch-in + title fly-in
# 90-270  : Scene 2 — Infographic reveal (zoom from center, slide sections)
# 270-540 : Scene 3 — Animated team spotlight (zoom into each region, 4 beats each)
# 540-720 : Scene 4 — Full infographic with kinetic text overlays
# 720-900 : Scene 5 — Closing: logo + tagline + red flash + black out
# (1860 total → 62s)
TOTAL_FRAMES = 62 * FPS

def scene1(f):
    """0–90: Dark intro with logo and title."""
    t = f / 90
    canvas = Image.new("RGB", (W,H), BLACK)
    draw = ImageDraw.Draw(canvas)

    # Red glow background
    if t > 0.1:
        gt = min((t-0.1)/0.4, 1.0)
        for i in range(12):
            r = int(lerp(0, 320, gt)) + i*20
            if r <= 0: continue
            alpha = max(0, int((1-i/12)*40*gt))
            draw.ellipse([W//2-r, H//2-r, W//2+r, H//2+r],
                         outline=(*RED, alpha), width=3)

    # Logo mark (draw_logo_shape analog)
    if t > 0.2:
        lt = ease_out(min((t-0.2)/0.5, 1.0))
        cx, cy = W//2, H//2 - 80
        s = int(lerp(0, 90, lt))
        if s > 5:
            pts_a = [(cx-s, cy+s), (cx-int(s*0.1), cy-s), (cx+int(s*0.15), cy+int(s*0.1))]
            pts_b = [(cx+int(s*0.05), cy-int(s*0.3)),
                     (cx+int(s*0.85), cy-s),
                     (cx+int(s*0.85), cy+int(s*0.2))]
            draw.polygon(pts_a, fill=RED)
            draw.polygon(pts_b, fill=RED)
            draw.rectangle([cx+int(s*0.15), cy+int(s*0.35),
                             cx+int(s*0.85), cy+s], fill=RED)

    # "SHORTHILLS AI" text slide-in
    if t > 0.4:
        tt = ease_out(min((t-0.4)/0.45, 1.0))
        tx_alpha = int(tt * 255)
        fn = fnt(72)
        off_x = int(lerp(-300, 0, tt))
        draw.text((W//2 - 310 + off_x, H//2 + 40), "SHORTHILLS",
                  font=fn, fill=(*WHITE, tx_alpha))
        fn2 = fnt(72)
        draw.text((W//2 + 5 + off_x, H//2 + 40), " AI",
                  font=fn2, fill=(*RED, tx_alpha))

    # Tagline fade-in
    if t > 0.65:
        tagt = ease_out(min((t-0.65)/0.3, 1.0))
        fn3 = fnt(28, bold=False)
        draw.text((W//2 - 260, H//2 + 128),
                  "SALES TEAM  ·  CHAMPIONS OF GROWTH",
                  font=fn3, fill=(*WHITE, int(tagt*180)))

    # Red underline
    if t > 0.7:
        ult = ease_out(min((t-0.7)/0.25, 1.0))
        lw = int(lerp(0, 520, ult))
        draw.line([(W//2 - 260, H//2+120), (W//2-260+lw, H//2+120)],
                  fill=RED, width=3)

    particles.step()
    canvas = particles.draw(canvas.convert("RGBA")).convert("RGB")
    return apply_vignette(canvas)


def scene2(f_local, f_global):
    """90–270 (local 0–180): Infographic zoom-reveal."""
    t = f_local / 180
    base = get_base()

    # Zoom from 1.8x → 1.0x (whole infographic reveal)
    scale = lerp(1.8, 1.0, ease_out(min(t*1.2, 1.0)))
    canvas = zoom_crop(base, scale)

    # Dark overlay fading out
    if t < 0.25:
        ov_alpha = int((1 - t/0.25) * 200)
        ov = Image.new("RGBA", (W,H), (0,0,0,0))
        ImageDraw.Draw(ov).rectangle([0,0,W,H], fill=(0,0,0,ov_alpha))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")

    # Red horizontal wipe lines (cinematic feel)
    draw = ImageDraw.Draw(canvas)
    if t < 0.15:
        lt = t / 0.15
        for i in range(3):
            yy = int(H * (0.25 + i*0.25))
            lw = int(lerp(W, 0, ease_out(lt)))
            draw.line([(0, yy), (lw, yy)], fill=RED, width=2)

    # "MEET THE TEAM" text punch-in
    if 0.55 < t < 0.95:
        mt = (t - 0.55) / 0.25
        if mt > 1: mt = 1
        alpha = int(ease_out(mt) * 230)
        scale_t = lerp(1.4, 1.0, ease_out(min(mt*1.3,1)))
        fn = fnt(80)
        text = "MEET THE TEAM"
        bbox = fn.getbbox(text)
        tw = bbox[2]-bbox[0]
        # Shadow
        draw.text((W//2 - tw//2 + 3, H//2 - 30 + 3), text, font=fn,
                  fill=(0,0,0,int(alpha*0.6)))
        draw.text((W//2 - tw//2, H//2 - 30), text, font=fn,
                  fill=(*RED, alpha))

    particles.step()
    canvas = particles.draw(canvas.convert("RGBA")).convert("RGB")
    return apply_vignette(scanlines(canvas))


# Spotlight regions in the infographic (normalized 0-1, x,y,w,h)
SPOTLIGHTS = [
    # (label, nx, ny, nw, nh) — center of region
    ("AYUSH GRACK\nCaptain", 0.5,  0.5,  0.4, 0.7),
    ("PRATHAM JAIN\nPillar 1", 0.18, 0.35, 0.3, 0.5),
    ("DHRUV KUMAR\nPillar 2", 0.18, 0.72, 0.3, 0.5),
    ("SAMEER & TEJASWI\nStrategists", 0.83, 0.35, 0.3, 0.5),
    ("ARSH & KASHISH\nClosers", 0.83, 0.72, 0.3, 0.5),
    ("ARYAN & HIMANSHU\nDream Team",  0.5,  0.88, 0.6, 0.25),
]

def scene3(f_local, f_global):
    """270–540 (local 0–270): Animated spotlights over infographic."""
    total_spots = len(SPOTLIGHTS)
    frames_per_spot = 270 // total_spots  # 45 frames each = 1.5s

    spot_idx = min(f_local // frames_per_spot, total_spots-1)
    spot_f   = f_local % frames_per_spot
    t        = spot_f / frames_per_spot

    sp = SPOTLIGHTS[spot_idx]
    label, nx, ny, nw, nh = sp

    base = get_base()

    # Zoom into spotlight region
    cx = int(nx * W); cy = int(ny * H)
    zoom_in  = ease_out(min(t * 3, 1.0))
    zoom_out_t = max(0, (t - 0.7) / 0.3)
    scale = lerp(lerp(1.0, 1.6, zoom_in), 1.0, ease_in(zoom_out_t))
    canvas = zoom_crop(base, scale, cx, cy)

    draw = ImageDraw.Draw(canvas)

    # Red border pulse
    pulse = 0.5 + 0.5*np.sin(t * 6 * np.pi)
    border_a = int(pulse * 160 + 50)
    draw.rectangle([0, 0, W-1, H-1], outline=(*RED, border_a), width=6)

    # Label text
    label_t = ease_out(min((t - 0.1) / 0.3, 1.0))
    if label_t > 0:
        fn = fnt(52)
        lines = label.split("\n")
        for li, line in enumerate(lines):
            bbox = fn.getbbox(line)
            tw = bbox[2]-bbox[0]
            alpha = int(label_t * 240)
            draw.text((W//2-tw//2+3, 40+li*64+3), line, font=fn,
                      fill=(0,0,0,int(alpha*0.7)))
            color = RED if li==0 else WHITE
            draw.text((W//2-tw//2, 40+li*64), line, font=fn,
                      fill=(*color, alpha))
        # underline
        draw.line([(W//2-180, 46+64*len(lines)), (W//2+180, 46+64*len(lines))],
                  fill=RED, width=3)

    # Beat flash: red flash at start of each spot
    if spot_f < 4:
        flash_a = (4 - spot_f) / 4 * 0.4
        canvas = red_flash(canvas, flash_a)

    particles.step()
    canvas = particles.draw(canvas.convert("RGBA")).convert("RGB")
    return apply_vignette(scanlines(canvas))


def scene4(f_local, f_global):
    """540–720 (local 0–180): Full infographic with kinetic overlay stats."""
    t = f_local / 180
    canvas = get_base().copy()
    draw = ImageDraw.Draw(canvas)

    # Dark overlay for text readability
    ov = Image.new("RGBA", (W,H), (0,0,0,0))
    ImageDraw.Draw(ov).rectangle([0,0,W,H], fill=(0,0,0,int(0.45*255)))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), ov).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    STATS = [
        ("9 ROCKSTARS", W//6,     H//3),
        ("1 MISSION",   W//2,     H//3),
        ("∞ RESULTS",   5*W//6,   H//3),
        ("100% HUSTLE", W//4,     2*H//3),
        ("ZERO LIMITS", 3*W//4,   2*H//3),
    ]

    for si, (txt, sx, sy) in enumerate(STATS):
        delay = si * 0.12
        st = max(0, (t - delay) / 0.35)
        if st <= 0: continue
        st = min(st, 1.0)
        alpha = int(ease_out(st) * 255)
        scale_f = lerp(1.6, 1.0, ease_out(st))
        fn = fnt(int(64 * scale_f))
        bbox = fn.getbbox(txt)
        tw = bbox[2]-bbox[0]; th = bbox[3]-bbox[1]
        # shadow
        draw.text((sx-tw//2+3, sy-th//2+3), txt, font=fn,
                  fill=(0,0,0,int(alpha*0.6)))
        color = RED if si%2==0 else WHITE
        draw.text((sx-tw//2, sy-th//2), txt, font=fn,
                  fill=(*color, alpha))

    # "ONE TEAM. ONE GOAL." banner at bottom
    if t > 0.6:
        bt = ease_out(min((t-0.6)/0.3, 1.0))
        draw.rectangle([W//6, H-130, 5*W//6, H-50],
                       fill=(0,0,0,int(bt*200)))
        draw.rectangle([W//6, H-130, 5*W//6, H-50],
                       outline=(*RED, int(bt*200)), width=2)
        fn_b = fnt(44)
        txt_b = "ONE TEAM.  ONE GOAL.  LIMITLESS POSSIBILITIES!"
        bbox_b = fn_b.getbbox(txt_b)
        tw_b = bbox_b[2]-bbox_b[0]
        draw.text((W//2-tw_b//2, H-108), txt_b, font=fn_b,
                  fill=(*WHITE, int(bt*255)))

    particles.step()
    canvas = particles.draw(canvas.convert("RGBA")).convert("RGB")
    return apply_vignette(scanlines(canvas))


def scene5(f_local, f_global):
    """720–900 (local 0–180): Closing — logo + tagline + red flash + blackout."""
    t = f_local / 180
    canvas = Image.new("RGB", (W,H), BLACK)
    draw = ImageDraw.Draw(canvas)

    # Red sweep background
    for i in range(20):
        r = int(lerp(0, 600, ease_out(min(t*1.5,1.0)))) + i*25
        if r <= 0: continue
        alpha = max(0, int((1-i/20)*50 * ease_out(min(t*1.5,1.0))))
        draw.ellipse([W//2-r, H//2-r, W//2+r, H//2+r],
                     outline=(*RED, alpha), width=4)

    # Logo
    if t > 0.05:
        lt = ease_out(min((t-0.05)/0.4, 1.0))
        cx, cy = W//2, H//2 - 100
        s = int(lt * 110)
        if s > 5:
            pts_a = [(cx-s, cy+s), (cx-int(s*0.1), cy-s), (cx+int(s*0.15), cy+int(s*0.1))]
            pts_b = [(cx+int(s*0.05), cy-int(s*0.3)),
                     (cx+int(s*0.85), cy-s),
                     (cx+int(s*0.85), cy+int(s*0.2))]
            draw.polygon(pts_a, fill=(*RED, int(lt*255)))
            draw.polygon(pts_b, fill=(*RED, int(lt*255)))
            draw.rectangle([cx+int(s*0.15), cy+int(s*0.35),
                             cx+int(s*0.85), cy+s], fill=(*RED, int(lt*255)))

    # "SHORTHILLS AI"
    if t > 0.3:
        nt = ease_out(min((t-0.3)/0.4, 1.0))
        fn = fnt(76)
        draw.text((W//2-340, H//2+30), "SHORTHILLS", font=fn,
                  fill=(*WHITE, int(nt*255)))
        draw.text((W//2+230, H//2+30), " AI", font=fn,
                  fill=(*RED, int(nt*255)))

    # Taglines
    TAGLINES = [
        "We Don't Just Sell. We Transform.",
        "Shorthills AI Sales Team — 2026",
    ]
    for ti, tl in enumerate(TAGLINES):
        delay = 0.5 + ti*0.15
        if t > delay:
            tlt = ease_out(min((t-delay)/0.3, 1.0))
            fn2 = fnt(32, bold=(ti==0))
            bbox = fn2.getbbox(tl)
            tw = bbox[2]-bbox[0]
            color = RED2 if ti==0 else WHITE
            draw.text((W//2-tw//2, H//2+120+ti*50), tl, font=fn2,
                      fill=(*color, int(tlt*220)))

    # Final red flash + fade to black
    if t > 0.8:
        ft = (t-0.8)/0.15
        if ft < 1:
            canvas = red_flash(canvas, ft * 0.5)
    if t > 0.9:
        bt = (t-0.9)/0.1
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([0,0,W,H], fill=(0,0,0,int(bt*255)))

    particles.step()
    canvas = particles.draw(canvas.convert("RGBA")).convert("RGB")
    return apply_vignette(canvas)


# ── Cross-dissolve ──────────────────────────────────────────────────────────
def dissolve(fa, fb, alpha):
    a = np.array(fa, dtype=np.float32)
    b = np.array(fb, dtype=np.float32)
    return Image.fromarray(np.clip(a*(1-alpha)+b*alpha, 0, 255).astype(np.uint8))

DISSOLVE_F = 15  # 0.5s transitions

def get_frame(f):
    """Return PIL RGB image for frame f."""
    # Scene boundaries
    S1_END = 90
    S2_START, S2_END = 90, 270
    S3_START, S3_END = 270, 540
    S4_START, S4_END = 540, 720
    S5_START, S5_END = 720, 900
    # pad last frames with scene5
    if f >= S5_END: f = S5_END - 1

    def s1(ff): return scene1(ff)
    def s2(ff): return scene2(ff - S2_START, ff)
    def s3(ff): return scene3(ff - S3_START, ff)
    def s4(ff): return scene4(ff - S4_START, ff)
    def s5(ff): return scene5(ff - S5_START, ff)

    # Transition zones
    if f < S1_END - DISSOLVE_F:
        return s1(f)
    elif f < S1_END:
        alpha = (f - (S1_END - DISSOLVE_F)) / DISSOLVE_F
        return dissolve(s1(f), s2(f), alpha)
    elif f < S2_END - DISSOLVE_F:
        return s2(f)
    elif f < S2_END:
        alpha = (f - (S2_END - DISSOLVE_F)) / DISSOLVE_F
        return dissolve(s2(f), s3(f), alpha)
    elif f < S3_END - DISSOLVE_F:
        return s3(f)
    elif f < S3_END:
        alpha = (f - (S3_END - DISSOLVE_F)) / DISSOLVE_F
        return dissolve(s3(f), s4(f), alpha)
    elif f < S4_END - DISSOLVE_F:
        return s4(f)
    elif f < S4_END:
        alpha = (f - (S4_END - DISSOLVE_F)) / DISSOLVE_F
        return dissolve(s4(f), s5(f), alpha)
    else:
        return s5(f)


# ── Render ──────────────────────────────────────────────────────────────────
def render():
    os.makedirs("visora_output/videos", exist_ok=True)
    silent_path = "visora_output/videos/enterprise_mktg_silent.mp4"
    final_path  = "visora_output/videos/shorthills_enterprise_video.mp4"

    writer = imageio.get_writer(
        silent_path, fps=FPS,
        codec='libx264', quality=8,
        ffmpeg_log_level='error',
        ffmpeg_params=['-preset','fast','-pix_fmt','yuv420p',
                       '-vf','scale=1920:1080'],
        output_params=[],
        macro_block_size=None,
    )

    TOTAL = TOTAL_SECS * FPS
    prev_pct = -1
    for f in range(TOTAL):
        frame = get_frame(f)
        writer.append_data(np.array(frame))
        pct = int(f / TOTAL * 100)
        if pct % 5 == 0 and pct != prev_pct:
            print(f"  {pct}%", end="  ", flush=True)
            prev_pct = pct
    writer.close()
    print("\nSilent video done.")

    # Mux audio
    audio_path = "visora_cache/rock_track.wav"
    if os.path.exists(audio_path):
        cmd = [FFMPEG, '-y',
               '-i', silent_path,
               '-i', audio_path,
               '-c:v', 'copy',
               '-c:a', 'aac', '-b:a', '192k',
               '-shortest',
               final_path]
        subprocess.run(cmd, check=True, capture_output=True)
        mb = os.path.getsize(final_path)/1e6
        print(f"✓ {final_path}  ({mb:.1f} MB)")
    else:
        import shutil; shutil.copy(silent_path, final_path)
        print(f"✓ {final_path}  (no audio found, silent copy)")


if __name__ == "__main__":
    print(f"Rendering enterprise marketing video {W}×{H} @ {FPS}fps, {TOTAL_SECS}s...")
    render()
