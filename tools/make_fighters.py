"""Generates the fighter caricature meshes for Beehive Brawl.

Run:  blender -b --factory-startup --python tools/make_fighters.py -- models/fighters.glb [preview.png]

Shapes are built from overlapping primitives, voxel-remeshed into single smooth
"sculpted" meshes, then decimated. Axes (Blender): +X = face forward, +Y = side,
+Z = up; the glTF exporter converts to three.js Y-up. Object names are
"<fighter>__<role>"; the game picks materials by role.
"""
import bpy, bmesh, math, sys, os
from mathutils import Matrix, Vector, Euler, noise
from mathutils.bvhtree import BVHTree

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else 'models/fighters.glb'
PREVIEW = ARGS[1] if len(ARGS) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
COL = bpy.context.scene.collection
V = Vector


def MX(loc=(0, 0, 0), scale=(1, 1, 1), rot=(0, 0, 0)):
    if isinstance(scale, (int, float)): scale = (scale,) * 3
    return Matrix.Translation(V(loc)) @ Euler(rot).to_matrix().to_4x4() @ Matrix.Diagonal((*scale, 1.0))


class B:
    """Accumulates primitives into one bmesh."""
    def __init__(s): s.bm = bmesh.new()

    def sph(s, loc, scale, rot=(0, 0, 0), seg=32):
        bmesh.ops.create_uvsphere(s.bm, u_segments=seg, v_segments=max(8, seg // 2), radius=1, matrix=MX(loc, scale, rot)); return s

    def box(s, loc, scale, rot=(0, 0, 0)):
        bmesh.ops.create_cube(s.bm, size=2, matrix=MX(loc, scale, rot)); return s

    def cyl(s, loc, r, h, rot=(0, 0, 0), r2=None, seg=40):
        bmesh.ops.create_cone(s.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2,
                              depth=h, matrix=MX(loc, 1, rot)); return s

    def chain(s, pts, r0, r1=None, step=.35):
        """Spheres along a polyline: a smooth tube once remeshed."""
        r1 = r0 if r1 is None else r1
        pts = [V(p) for p in pts]; L = [0.0]
        for a, b in zip(pts, pts[1:]): L.append(L[-1] + (b - a).length)
        tot = L[-1] or 1e-6
        n = max(2, int(tot / (min(r0, r1) * step)) + 1)
        for i in range(n):
            u = i / (n - 1) * tot; j = 0
            while j < len(pts) - 2 and L[j + 1] < u: j += 1
            sl = (L[j + 1] - L[j]) or 1e-6
            s.sph(pts[j].lerp(pts[j + 1], min(1, (u - L[j]) / sl)), r0 + (r1 - r0) * u / tot, seg=16)
        return s

    def slab(s, p0, p1, w0, w1, th, up=(1, 0, 0)):
        """Flat strip from p0 to p1 (width along the side axis, thickness along `up`)."""
        p0, p1 = V(p0), V(p1); d = p1 - p0; n = 14
        for i in range(n):
            a = p0 + d * (i / n); b = p0 + d * ((i + 1) / n); c = (a + b) / 2
            w = w0 + (w1 - w0) * (i + .5) / n
            z = (b - a).normalized(); x = V(up).normalized(); y = z.cross(x).normalized(); x = y.cross(z)
            R = Matrix((x, y, z)).transposed().to_4x4()
            bmesh.ops.create_cube(s.bm, size=2, matrix=Matrix.Translation(c) @ R @ Matrix.Diagonal((th, w, (b - a).length * .75, 1)))
        return s

    def cut(s, co, no):
        """Remove everything on the side `no` points to, and cap the holes."""
        geom = s.bm.verts[:] + s.bm.edges[:] + s.bm.faces[:]
        bmesh.ops.bisect_plane(s.bm, geom=geom, plane_co=V(co), plane_no=V(no).normalized(), clear_outer=True)
        bmesh.ops.holes_fill(s.bm, edges=[e for e in s.bm.edges if e.is_boundary], sides=0)
        return s

    def add(s, o):
        me = bpy.data.meshes.new('tmp'); o.bm.to_mesh(me); o.bm.free(); s.bm.from_mesh(me); bpy.data.meshes.remove(me); return s


def apply(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data; ob.modifiers.clear(); ob.data = me; bpy.data.meshes.remove(old)


TEX = {}
def make(name, b, voxel=.012, smooth=(.5, 4), faces=None, disp=None):
    me = bpy.data.meshes.new(name); b.bm.to_mesh(me); b.bm.free()
    ob = bpy.data.objects.new(name, me); COL.objects.link(ob)
    if voxel:
        m = ob.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.adaptivity = 0
    if disp:  # (strength, noise scale)
        key = disp[1]
        if key not in TEX:
            t = TEX[key] = bpy.data.textures.new('n%s' % key, 'CLOUDS'); t.noise_scale = key; t.noise_depth = 2
        m = ob.modifiers.new('dp', 'DISPLACE'); m.texture = TEX[key]; m.strength = disp[0]; m.mid_level = .5
    if smooth and smooth[1]:
        m = ob.modifiers.new('sm', 'SMOOTH'); m.factor = smooth[0]; m.iterations = smooth[1]
    apply(ob)
    if faces and len(ob.data.polygons) > faces:
        m = ob.modifiers.new('dc', 'DECIMATE'); m.ratio = faces / len(ob.data.polygons); apply(ob)
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def recenter(ob, c):
    ob.data.transform(Matrix.Translation(-V(c))); ob.location = V(c)


def vcol(ob, fn):
    me = ob.data
    a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(me.vertices): a.data[i].color = (*fn(v.co), 1.0)
    me.color_attributes.active_color = a


def fall(p, c, r):
    d = (p - V(c)).length / r
    return max(0.0, 1 - d * d) ** 1.5


def mix(col, tgt, w):
    w = max(0.0, min(1.0, w)); return [a * (1 - w) + b * w for a, b in zip(col, tgt)]


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


# =====================================================================
# Fighter definitions (caricature parameters)
# =====================================================================
BASE = dict(cw=1, ch=1, cd=1, jw=1, jh=1, chin=1, cheek=1, nose=1, nl=1, ears=1, jowl=0, brow=1, mw=1, smile=.25, teeth=False,
            ey=.2, ez=.05, er=.092, lid=.3, lid_tilt=0, brow_ang=0, brow_th=1, brow_arch=1, stubble=0, lips=1,
            hair='short', glasses=None, beard=False, hat=False,
            body=dict(belly=0, shoulders=1, fem=False, tie=True, open=False))

FIGHTERS = {
    # fully shaved egg-shaped dome, big ears, broad toothy grin
    'luxon': dict(ch=1.1, cw=1.0, cd=1.02, jh=1.05, jw=1.0, chin=1.1, nose=1.0, nl=1.0, smile=.8, mw=1.25, teeth=True, brow_th=.85,
                  ears=1.3, stubble=.1, hair='luxon', lid=.34),
    # round ruddy face, big ears, strawberry-blond hair pushed up at the front
    'hipkins': dict(cw=1.08, jw=1.12, jh=.98, cheek=1.15, chin=.9, nose=1.0, smile=.55, mw=1.05, teeth=True, hair='hipkins',
                    stubble=.05, ears=1.35, brow_th=.8),
    # longer narrow face, firm jaw, cropped dark hair, wry half-smile
    'seymour': dict(cw=.96, ch=1.04, jw=.92, jh=1.08, chin=1.05, cheek=.95, nose=1.05, nl=1.05, smile=.3, mw=1.0, ears=1.1,
                    hair='seymour', brow_arch=.8, lid=.36, stubble=.3),
    # long face, strong nose, heavy brows, silver hair swept back, closed knowing smile
    'peters': dict(ch=1.06, jw=1.06, jh=1.1, chin=1.15, cheek=1.1, nose=1.3, nl=1.15, smile=.5, mw=1.1, brow_ang=.25, brow=1.3,
                   brow_th=1.3, lid=.44, lid_tilt=.1, hair='peters', stubble=.15, ears=1.15),
    # youthful, shoulder-length brown bob, big smile
    'swarbrick': dict(cw=.95, jw=.86, jh=.9, chin=.85, cheek=1.1, nose=.85, nl=.85, smile=.75, mw=1.05, teeth=True, lips=1.15,
                      er=.1, brow_th=.75, brow_arch=1.4, hair='bob',
                      body=dict(belly=0, shoulders=.86, fem=True, tie=False, open=True)),
    # long dark wavy hair with a side part, wide lipsticked smile
    'willis': dict(cw=.98, ch=1.03, jw=.92, jh=.95, chin=.95, cheek=1.15, nose=.95, nl=.95, smile=.75, mw=1.15, teeth=True,
                   lips=1.25, er=.098, brow_th=.8, brow_arch=1.3, hair='long',
                   body=dict(belly=0, shoulders=.88, fem=True, tie=False, open=True)),
    # broad face, grey goatee, tinted specs under a wide-brimmed hat
    'waititi': dict(cw=1.05, jw=1.1, jh=1.0, chin=1.05, cheek=1.15, nose=1.2, nl=1.0, smile=.85, mw=1.15, teeth=True, brow_th=1.2,
                    hair='waititi', beard=True, hat=True, glasses='rect',
                    body=dict(belly=.15, shoulders=1.1, fem=False, tie=False, open=True)),
    # big round head and jowls, grey hair, heavy black rectangular specs, beaming
    'brownlee': dict(cw=1.12, cd=1.05, ch=1.02, jw=1.22, jh=1.05, chin=.9, cheek=1.2, jowl=1, nose=1.15, nl=.9, smile=.65, mw=1.1,
                     teeth=True, glasses='rect', hair='brownlee', brow_th=1.0, lid=.42, stubble=.05, ears=1.1,
                     body=dict(belly=.5, shoulders=1.12, fem=False, tie=True, open=False)),
}


# =====================================================================
# Head
# =====================================================================
def crani(p):
    return V((-.04, 0, .1)), V((.55 * p['cd'], .5 * p['cw'], .56 * p['ch']))


def build_head(fid, p):
    b = B()
    cc, cr = crani(p)
    b.sph(cc, cr)
    b.sph((.14, 0, -.12), (.44, .42 * p['jw'], .42 * p['jh']))
    b.sph((.14, 0, -.3 * p['jh']), (.36, .36 * p['jw'], .25))
    for s in (-1, 1):
        b.sph((.0, s * .3 * p['jw'], -.25 * p['jh']), (.2, .13, .17))
        b.sph((.33, s * .24, -.07), (.13 * p['cheek'], .14 * p['cheek'], .11 * p['cheek']))
        b.sph((-.02, s * .5 * p['cw'], -.03), (.085 * p['ears'], .045, .14 * p['ears']), rot=(s * .15, -.15, s * .45))
        b.sph((.58, s * .075 * p['nose'], -.1), .05 * p['nose'])
        if p['jowl']:
            b.sph((.16, s * .28 * p['jw'], -.32), (.22 * p['jowl'], .14 * p['jowl'], .18 * p['jowl']))
    chz = -.47 * p['jh']
    b.sph((.35, 0, chz), (.14, .15 * p['chin'], .1 * p['chin']))
    b.sph((.44, 0, .2), (.1, .34, .045 * p['brow']))
    tip = V((.6 + .07 * p['nl'] * p['nose'], 0, -.07))
    b.chain([(.52, 0, .17), (.57, 0, .06), tip], .045 * p['nose'], .075 * p['nose'])
    if p['jowl']:
        b.sph((.2, 0, -.53), (.28, .3, .12))
    b.cyl((-.06, 0, -.55), .21 * p['jw'], .4)
    head = make(fid + '__skin', b, voxel=.011, smooth=(.5, 8), faces=4500)

    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(head, dg)

    def hit(y, z, x0=2.0):
        loc, *_ = bvh.ray_cast(V((x0, y, z)), V((-1, 0, 0)))
        return loc if loc else V((.5, y, z))

    # Features are drawn on in the game (front-projected face texture); we only need the eye
    # positions here for the glasses and the shading.
    ey, ez, er = p['ey'], p['ez'], p['er']
    eyes = []
    for s_ in (-1, 1):
        c = hit(s_ * ey, ez); c.x -= er * .55; eyes.append(c)

    # skin vertex colours: blush, lips, stubble, ear and socket shading

    def skin(co):
        c = [1.0, 1.0, 1.0]
        for s in (-1, 1):
            c = mix(c, (1, .72, .7), fall(co, (.42, s * .27, -.11), .2) * .55)
            c = mix(c, (1, .74, .72), fall(co, (-.03, s * .55 * p['cw'], -.02), .16) * .5)
            c = mix(c, (.85, .74, .72), fall(co, eyes[(s + 1) // 2], .16) * .3)
        c = mix(c, (1, .78, .76), fall(co, tip, .09) * .45)
        lw = 0.0
        if p['stubble']:
            sw = smoothstep(-.17, -.32, co.z) * smoothstep(-.15, .15, co.x) * (1 - min(1, lw * 3))
            c = mix(c, (.72, .72, .78), sw * p['stubble'] * 1.6)
        c = mix(c, (.9, .82, .8), smoothstep(-.5, -.75, co.z))  # neck shade
        return c
    vcol(head, skin)
    return head, hit, eyes


# =====================================================================
# Hair, beard, glasses, hat
# =====================================================================
def cap(p, thick=.06, cuts=()):
    cc, cr = crani(p)
    b = B().sph(cc, cr * (1 + thick), seg=48)
    for co, no in cuts: b.cut(co, no)
    return b


def build_hair(fid, p):
    h = p['hair']; b = B()
    if h == 'luxon':  # clean-shaven: just a faint stubble shadow low at the back and sides
        b.add(cap(p, .012, [((0, 0, .02), (0, 0, 1)), ((.0, 0, 0), (1, 0, .3)), ((0, 0, -.3), (0, 0, -1))]))
        return make(fid + '__hair', b, voxel=.008, smooth=(.5, 2), faces=1200)
    if h == 'brownlee':  # grey, thin on top, full at the sides, combed back from a high forehead
        b.add(cap(p, .05, [((.26, 0, .3), (1, 0, -.5)), ((0, 0, -.02), (.5, 0, -1)), ((0, 0, -.3), (0, 0, -1))]))
        for s in (-1, 1): b.sph((-.12, s * .44 * p['cw'], .08), (.3, .14, .2))
        return make(fid + '__hair', b, voxel=.01, smooth=(.5, 4), faces=2200, disp=(.012, .03))
    if h == 'hipkins':  # short, pushed up and forward at the front
        b.add(cap(p, .06, [((.3, 0, .32), (1, 0, -.55)), ((0, 0, -.04), (.45, 0, -1)), ((0, 0, -.28), (0, 0, -1))]))
        b.sph((.3, 0, .46), (.2, .38, .12), rot=(0, -.45, 0))
        return make(fid + '__hair', b, voxel=.01, smooth=(.5, 4), faces=2200, disp=(.014, .035))
    if h == 'seymour':  # cropped dark, a bit of texture on top, slightly receding at the temples
        b.add(cap(p, .055, [((.3, 0, .32), (1, 0, -.55)), ((0, 0, -.04), (.45, 0, -1)), ((0, 0, -.28), (0, 0, -1))]))
        for s in (-1, 1): b.cut((.3, s * .2, .3), (.6, s * .8, -.4))
        b.sph((.22, 0, .5), (.28, .3, .12), rot=(0, -.2, 0))
        return make(fid + '__hair', b, voxel=.01, smooth=(.5, 3), faces=2200, disp=(.02, .025))
    if h == 'peters':  # voluminous silver, swept straight back
        b.add(cap(p, .09, [((.3, 0, .32), (1, 0, -.55)), ((0, 0, -.02), (.4, 0, -1)), ((0, 0, -.3), (0, 0, -1))]))
        b.sph((-.1, 0, .32), (.5, .48, .34))
        b.sph((.22, 0, .5), (.26, .42, .14), rot=(0, -.3, 0))
        b.sph((-.34, 0, .02), (.3, .47, .32))
        b.cut((0, 0, -.22), (0, 0, -1))
        return make(fid + '__hair', b, voxel=.011, smooth=(.5, 4), faces=2600, disp=(.014, .06))
    if h == 'bob':  # shoulder-length bob, side part
        b.add(cap(p, .08, [((.3, 0, .32), (1, 0, -.55))]))
        b.sph((-.08, 0, -.2), (.56, .62, .56))
        b.sph((.24, .1, .43), (.24, .33, .1), rot=(.2, -.25, 0))
        b.cut((0, 0, -.68), (0, 0, -1)).cut((.22, 0, .25), (1, 0, -.35))
        return make(fid + '__hair', b, voxel=.011, smooth=(.5, 5), faces=2800, disp=(.014, .05))
    if h == 'long':  # long, wavy, side part, falling past the shoulders
        b.add(cap(p, .08, [((.3, 0, .32), (1, 0, -.55))]))
        b.sph((.24, .1, .44), (.25, .34, .1), rot=(.2, -.25, 0))
        for s in (-1, 1):
            b.chain([(-.04, s * .47, .0), (-.08, s * .5, -.45), (-.05, s * .46, -.9), (-.1, s * .52, -1.15)], .14, .1)
        b.sph((-.3, 0, -.4), (.26, .46, .72))
        b.cut((.22, 0, .25), (1, 0, -.35)).cut((0, 0, -1.2), (0, 0, -1))
        return make(fid + '__hair', b, voxel=.012, smooth=(.5, 5), faces=3200, disp=(.02, .1))
    if h == 'waititi':  # short under the hat
        b.add(cap(p, .035, [((.3, 0, .32), (1, 0, -.55)), ((0, 0, -.06), (.45, 0, -1)), ((0, 0, -.3), (0, 0, -1))]))
        return make(fid + '__hair', b, voxel=.01, smooth=(.5, 3), faces=1500)


def build_beard(fid, p, hit):
    """Short goatee: chin + moustache joined round the mouth corners."""
    b = B()
    up = [hit(t * .15, -.245 + .02 * t * t) + V((.006, 0, 0)) for t in (-1, -.5, 0, .5, 1)]
    lo = [hit(t * .15, -.4 - .07 * (1 - t * t)) + V((.006, 0, 0)) for t in (-1, -.5, 0, .5, 1)]
    b.chain(up, .028, .028)
    b.chain(lo, .06, .06)
    for i in (0, -1): b.chain([up[i], hit(up[i].y * 1.05, -.33) + V((.006, 0, 0)), lo[i]], .03, .04)
    b.sph(hit(0, -.47) + V((-.03, 0, 0)), (.12, .15, .1))
    return make(fid + '__beard', b, voxel=.009, smooth=(.5, 3), faces=2200, disp=(.012, .02))


def build_glasses(fid, p, eyes, kind):
    fr, ln = B(), B()
    hw, hh, rc = (.125, .085, .035) if kind == 'rect' else (.12, .1, .08)
    for i, c in enumerate(eyes):
        s = -1 if i == 0 else 1
        cx = c.x + p['er'] + .045
        pts = []
        for k in range(29):
            a = k / 28 * math.tau
            y, z = math.cos(a), math.sin(a)
            # superellipse: rounded rectangle
            e = .35 if kind == 'rect' else 1.0
            y = math.copysign(abs(y) ** e, y) * hw; z = math.copysign(abs(z) ** e, z) * hh
            pts.append((cx, c.y + y, c.z + .01 + z))
        fr.chain(pts, .024, .024, step=.4)
        ln.sph((cx - .005, c.y, c.z + .01), (.008, hw * .95, hh * .95), seg=24)
        fr.chain([(cx, c.y + s * hw, c.z + .06), (cx - .25, s * .5 * p['cw'], c.z + .06), (-.05, s * .52 * p['cw'], .0)], .013, .013)
    fr.chain([(eyes[0].x + p['er'] + .05, eyes[0].y + hw, eyes[0].z + .04), (eyes[0].x + p['er'] + .07, 0, eyes[0].z + .05),
              (eyes[1].x + p['er'] + .05, eyes[1].y - hw, eyes[1].z + .04)], .014, .014)
    make(fid + '__glass', fr, voxel=.009, smooth=(.5, 2), faces=1600)
    make(fid + '__lens', ln, voxel=0, smooth=None)


def build_hat(fid, p):
    hat = B()
    hat.cyl((0, 0, .52), .5, .46, r2=.44)
    hat.sph((0, 0, .74), (.44, .36, .07))
    for k in range(48):  # brim, turned up a little at the sides
        a = k / 48 * math.tau
        hat.sph((math.cos(a) * .45, math.sin(a) * .41, .31 + .06 * math.sin(a) ** 2), (.26, .2, .028), rot=(0, 0, a), seg=16)
    hat.cyl((0, 0, .31), .6, .05)
    hat.cut((0, 0, .8), (0, 0, 1))
    o = make(fid + '__hat', hat, voxel=.012, smooth=(.5, 4), faces=2500)
    band = make(fid + '__band', B().cyl((0, 0, .37), .5, .045, r2=.495, seg=64), voxel=0, smooth=None)
    for ob in (o, band): ob.data.transform(MX((0, 0, .03), 1, (0, -.08, 0)))


# =====================================================================
# Body: jacket, shirt, lapels, tie, buttons (origin = torso centre)
# =====================================================================
def build_body(fid, bp):
    sh, fem, belly = bp['shoulders'], bp['fem'], bp['belly']
    j = B()
    j.box((0, 0, -.06), (.22, .36 * sh, .5))
    j.sph((0, 0, .12), (.28, .42 * sh, .4))
    j.sph((-.02, 0, .34), (.23, .56 * sh, .18))
    if belly: j.sph((.08, 0, -.16), (.3 * (1 + belly * .35), .42, .36))
    j.cyl((-.03, 0, .5), .2, .16)
    j.cut((0, 0, -.64), (0, 0, -1))
    jacket = make(fid + '__jacket', j, voxel=.016, smooth=(.5, 12), faces=2500)

    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(jacket, dg)

    def hit(y, z):
        loc, *_ = bvh.ray_cast(V((2, y, z)), V((-1, 0, 0)))
        return loc if loc else V((.3, y, z))

    # shirt V and collar, sitting just proud of the jacket
    top = hit(0, .5)
    sv = B()
    sv.sph(hit(0, .32) + V((-.035, 0, 0)), (.05, .09, .22))
    sv.cyl((-.03, 0, .58), .18, .14, r2=.16)
    for s in (-1, 1):
        sv.slab(top + V((.02, s * .03, .06)), top + V((.04, s * .12, -.06)), .07, .03, .02)
    make(fid + '__shirt', sv, voxel=.009, smooth=(.5, 3), faces=1500)

    lap = B()
    for s in (-1, 1):
        a, c = hit(s * .13, .52), hit(s * .04, .02)
        mid = hit(s * .2, .3)
        lap.slab(a + V((.01, 0, 0)), mid + V((.01, 0, 0)), .035, .06, .01)
        lap.slab(mid + V((.01, 0, 0)), c + V((.01, 0, 0)), .06, .012, .01)
    make(fid + '__lapel', lap, voxel=.007, smooth=(.5, 4), faces=1000)

    btn = B()
    for z in ((-.08, -.26) if not belly else (-.12,)):
        q = hit(0, z); btn.cyl(q + V((.012, 0, 0)), .035, .02, rot=(0, math.pi / 2, 0), seg=20)
    make(fid + '__button', btn, voxel=0, smooth=None)

    if bp['tie']:
        knot = hit(0, .5) + V((.035, 0, 0))
        pts = [hit(0, z) + V((.04, 0, 0)) for z in (.44, .3, .15, 0, -.12)]
        t = B().sph(knot, (.03, .04, .04))
        for a, c in zip(pts, pts[1:]):
            t.slab(a, c, .026 + (.44 - a.z) * .04, .026 + (.44 - c.z) * .04, .008)
        make(fid + '__tie', t, voxel=.006, smooth=(.5, 3), faces=800)


def build_common():
    h = B()
    h.sph((0, 0, -.11), (.085, .072, .1))
    for i in range(4):
        y = (-.048 + .032 * i)
        h.sph((.03, y, -.2), .034)
        h.sph((.075, y, -.15), (.034, .03, .045))
    h.chain([(.02, .07, -.05), (.06, .065, -.11), (.085, .04, -.13)], .03, .026)
    h.cyl((0, 0, .0), .07, .08)
    make('common__hand', h, voxel=.008, smooth=(.5, 3), faces=1000)
    # hand shapes swapped in per pose (fist above; open palm, pointing, thumbs up).
    # Local axes: the hand hangs down -Z from the wrist, knuckles face +X.
    def fist(extra):
        b = B()
        b.sph((0, 0, -.11), (.085, .072, .1))
        for i in range(4):
            y = -.048 + .032 * i
            if extra != 'point' or i != 0: b.sph((.03, y, -.2), .034); b.sph((.075, y, -.15), (.034, .03, .045))
        b.cyl((0, 0, .0), .07, .08)
        return b
    p = B()
    p.sph((0, 0, -.1), (.05, .085, .11)); p.cyl((0, 0, .0), .07, .08)
    for i in range(4):
        y = -.054 + .036 * i
        p.chain([(.0, y, -.18), (.005, y * 1.1, -.27), (.01, y * 1.15, -.33 + abs(i - 1.5) * .02)], .024, .019)
    p.chain([(.0, .075, -.08), (.03, .12, -.13), (.05, .14, -.17)], .026, .02)
    make('common__palm', p, voxel=.008, smooth=(.5, 3), faces=1000)
    pt = fist('point')
    pt.chain([(.03, -.048, -.18), (.03, -.05, -.28), (.03, -.05, -.36)], .026, .02)  # index finger along the arm
    pt.chain([(.02, .07, -.05), (.06, .065, -.11), (.085, .04, -.13)], .03, .026)
    make('common__point', pt, voxel=.008, smooth=(.5, 3), faces=1000)
    th = fist('thumb')
    th.chain([(.05, .065, -.07), (.12, .06, -.07), (.18, .055, -.06)], .03, .025)  # thumb out along +X (up when the arm is raised)
    make('common__thumb', th, voxel=.008, smooth=(.5, 3), faces=1000)
    make('common__cuff', B().cyl((0, 0, .02), .095, .07, r2=.09), voxel=.008, smooth=(.5, 1), faces=600)
    s = B()
    s.sph((-.08, 0, -.03), (.11, .12, .085))
    s.sph((.06, 0, -.04), (.14, .12, .075))
    s.sph((.18, 0, -.06), (.11, .11, .06))
    s.sph((0, 0, .03), (.1, .09, .09))
    s.cut((0, 0, -.1), (0, 0, -1))
    make('common__shoe', s, voxel=.009, smooth=(.5, 3), faces=1000)
    make('common__sole', B().sph((.04, 0, -.1), (.27, .125, .025), seg=32).cut((0, 0, -.1), (0, 0, -1)), voxel=0, smooth=None)


# =====================================================================
for fid, over in FIGHTERS.items():
    p = dict(BASE); p.update(over); p['body'] = {**BASE['body'], **over.get('body', {})}
    head, hit, eyes = build_head(fid, p)
    build_hair(fid, p)
    if p['beard']: build_beard(fid, p, hit)
    if p['glasses']: build_glasses(fid, p, eyes, p['glasses'])
    if p['hat']: build_hat(fid, p)
    build_body(fid, p['body'])
    print('built', fid, flush=True)
build_common()

tot = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('TOTAL_FACES', tot)

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
kw = dict(filepath=os.path.abspath(OUT), export_format='GLB', export_yup=True, export_apply=True, export_materials='NONE')
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
except TypeError:
    bpy.ops.export_scene.gltf(**kw, export_colors=True)
print('EXPORTED', OUT, os.path.getsize(OUT))
# Also wrap as a classic script so index.html works straight off the disk (file:// can't fetch a .glb).
import base64
js = os.path.splitext(os.path.abspath(OUT))[0] + '.js'
with open(OUT, 'rb') as f, open(js, 'w') as o:
    o.write('// Generated by tools/make_fighters.py. Do not edit.\nwindow.NZF_GLB="' + base64.b64encode(f.read()).decode() + '";\n')
print('WROTE', js, os.path.getsize(js))

if PREVIEW:  # quick lineup render of the heads for checking likeness
    sc = bpy.context.scene
    for i, fid in enumerate(FIGHTERS):
        for o in bpy.data.objects:
            if o.name.startswith(fid + '__'):
                o.location.y += (i - 3.5) * 1.6
                if o.name.split('__')[1] in ('jacket', 'shirt', 'lapel', 'button', 'tie'): o.location.z -= 2.0
    for o in bpy.data.objects:
        if o.name.startswith('common__'): o.hide_render = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); COL.objects.link(cam)
    cam.location = (15, 0, -0.5); cam.rotation_euler = (math.radians(90), 0, math.radians(90))
    cam.data.lens = 45; sc.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); COL.objects.link(sun)
    sun.rotation_euler = (math.radians(50), 0, math.radians(60)); sun.data.energy = 3
    sc.world = bpy.data.worlds.new('w'); sc.world.color = (.4, .4, .45)
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'VERTEX'
    sc.render.resolution_x, sc.render.resolution_y = 2000, 900
    cam.data.lens = 40
    sc.render.filepath = os.path.abspath(PREVIEW)
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', PREVIEW)
