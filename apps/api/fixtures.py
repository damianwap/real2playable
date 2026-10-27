"""Original illustrations authored with geometric Pillow drawing, not photos or AI."""
import math
from PIL import Image, ImageDraw

SAMPLES = {
    "cactus": ("Petal the Cactus", "An original, hand-coded flowering cactus in a peach pot."),
    "mushroom": ("Mallow Mushroom", "An original coral-capped woodland mushroom illustration."),
    "mug": ("Sunday Mug", "An original sky-blue ceramic mug with a tiny sunshine motif."),
}
INK = "#303239"


def illustration(kind: str) -> Image.Image:
    # Supersampling gives the authored contours smooth, print-like edges.
    im = Image.new("RGBA", (1536, 1536))
    d = ImageDraw.Draw(im)
    def ellipse(box, fill, outline=INK, width=6):
        d.ellipse(tuple(round(n * 3) for n in box), fill=fill, outline=outline, width=width * 3)
    def rounded(box, radius, fill, outline=INK, width=6):
        d.rounded_rectangle(tuple(round(n * 3) for n in box), radius=radius * 3, fill=fill, outline=outline, width=width * 3)
    def line(points, fill, width):
        coords = [(round(x * 3), round(y * 3)) for x, y in points]
        d.line(coords, fill=fill, width=width * 3, joint="curve")
        for x, y in (points[0], points[-1]):
            ellipse((x-width/2, y-width/2, x+width/2, y+width/2), fill, None, 0)
    def polygon(points, fill, width=6):
        coords = [(round(x * 3), round(y * 3)) for x, y in points]
        d.polygon(coords, fill=fill)
        d.line(coords+[coords[0]], fill=INK, width=width * 3, joint="curve")
    if kind == "cactus":
        # Rounded branching silhouette; outlines join without internal seam artifacts.
        line([(236, 277), (164, 277), (164, 203)], INK, 67)
        line([(236, 277), (164, 277), (164, 203)], "#67ad77", 55)
        line([(281, 242), (347, 242), (347, 163)], INK, 67)
        line([(281, 242), (347, 242), (347, 163)], "#67ad77", 55)
        rounded((211, 101, 299, 362), 44, "#73b784")
        line([(236, 143), (236, 318)], "#a3d29c", 7)
        line([(276, 147), (276, 318)], "#529a65", 5)
        for x,y in [(221,181),(284,209),(222,275),(287,300),(154,225),(356,188)]:
            line([(x-4,y-4),(x+3,y+3)], "#477f54", 3)
        for a in range(5):
            angle = a * math.tau / 5 - math.pi / 2
            x, y = 264+23*math.cos(angle), 101+23*math.sin(angle)
            ellipse((x-15,y-16,x+15,y+16), "#e99bb3", INK, 4)
        ellipse((252,89,276,113), "#f5cd74", INK, 4)
        polygon([(183,350),(329,350),(309,438),(202,438)], "#df9c80")
        rounded((174,333,338,364), 10, "#f1b59a")
        line([(214,382),(220,416)], "#f5c7ac", 6)
        ellipse((233,384,241,394), INK, None, 0)
        ellipse((270,384,278,394), INK, None, 0)
        d.arc((244*3,386*3,267*3,408*3), 15, 165, fill=INK, width=3*3)
    elif kind == "mushroom":
        polygon([(220,258),(294,258),(317,419),(195,419)], "#f2d6b4")
        ellipse((192,391,321,445), "#f2d6b4")
        ellipse((116,202,397,310), "#e6b09b")
        # Cap formed with a polygonal domed contour sampled from an ellipse.
        pts=[(110,257)]+[(256+146*math.cos(math.pi+i*math.pi/60),257+146*math.sin(math.pi+i*math.pi/60)) for i in range(61)]+[(402,257)]
        polygon(pts, "#d97b75")
        ellipse((158,197,201,231), "#ffddbd", INK, 3)
        ellipse((231,143,283,186), "#ffddbd", INK, 3)
        ellipse((315,208,353,238), "#ffddbd", INK, 3)
        line([(220,283),(215,330)], "#d7b89c", 4)
        ellipse((234,349,242,359), INK, None, 0)
        ellipse((274,349,282,359), INK, None, 0)
        d.arc((246*3,350*3,270*3,373*3), 10, 170, fill=INK, width=3*3)
    elif kind == "mug":
        ellipse((307,205,415,355), "#8dbccd")
        ellipse((332,230,389,328), (0,0,0,0))
        rounded((140,187,340,414), 32, "#a9d1dc")
        ellipse((139,168,341,223), "#d6edf0")
        ellipse((153,179,327,210), "#795c50", INK, 4)
        line([(164,235),(164,355)], "#d8eef0", 7)
        for x in [215,264]:
            line([(x,137),(x-10,118),(x+2,95)], "#a4b8bd", 5)
        ellipse((211,272,279,340), "#f3cc7b", INK, 4)
        for i in range(8):
            a=i*math.tau/8
            line([(245+43*math.cos(a),306+43*math.sin(a)),(245+49*math.cos(a),306+49*math.sin(a))], "#dbab56", 3)
        ellipse((231,299,237,307), INK, None, 0)
        ellipse((254,299,260,307), INK, None, 0)
        d.arc((237*3,303*3,256*3,322*3), 5, 175, fill=INK, width=3*3)
    else:
        raise ValueError("Unknown fixture")
    return im.resize((512,512), Image.Resampling.LANCZOS)


def source_illustration(sprite: Image.Image) -> Image.Image:
    source = Image.new("RGBA", (768,640), "#eee9df")
    draw = ImageDraw.Draw(source)
    draw.rounded_rectangle((40,35,728,605), radius=30, fill="#f7f3eb")
    draw.ellipse((185,515,590,559), fill="#ddd6c9")
    source.alpha_composite(sprite, (128,38))
    return source
