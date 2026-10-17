"""Composite a real product cutout into an empty Daylight Linen scene (product pixels untouched).
usage: scene.py BG CUTOUT OUT CX BASE_Y HEIGHT [CAST_LEN] [CAST_RISE]
CX/BASE_Y/HEIGHT are in BG pixels; output is 1600x1600 JPEG.
Light is from the upper left, so the cast shadow falls to the right along the surface."""
import sys
from PIL import Image, ImageFilter, ImageChops, ImageDraw
import numpy as np
from scipy.ndimage import gaussian_filter
bg=Image.open(sys.argv[1]).convert('RGB'); cut=Image.open(sys.argv[2]).convert('RGBA')
out=sys.argv[3]; cx,base,H=map(float,sys.argv[4:7])
cast=float(sys.argv[7]) if len(sys.argv)>7 else 0.75
rise=float(sys.argv[8]) if len(sys.argv)>8 else 0.05
cut=cut.crop(cut.split()[-1].point(lambda v:255 if v>24 else 0).getbbox())
a=cut.split()[-1].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
cut.putalpha(ImageChops.multiply(cut.split()[-1],a))
k=H/cut.height; cut=cut.resize((round(cut.width*k),round(H)),Image.LANCZOS)
w,h=cut.size; x=round(cx-w/2); y=round(base-h)
N=bg.width
# shadow density map on the full canvas (no clipped blur edges)
sh=np.zeros((N,N))
# cast: a parallelogram from the base running right and slightly back toward the wall, fading out
L=h*cast; R=h*rise
img=Image.new('L',(N,N),0); d=ImageDraw.Draw(img)
steps=40
for i in range(steps):
    t0,t1=i/steps,(i+1)/steps
    op=int(255*(1-t0)**1.6)
    d.polygon([(x+w*0.15+L*t0,base-R*t0),(x+w*0.95+L*t0,base-R*t0-2),(x+w*0.95+L*t1,base-R*t1-2),(x+w*0.15+L*t1,base-R*t1)],fill=op)
cast_m=gaussian_filter(np.asarray(img,float)/255,N*0.010)*0.30
# contact: thin dark ellipse right under the base
img=Image.new('L',(N,N),0)
ImageDraw.Draw(img).ellipse([x+w*0.02,base-w*0.035,x+w*0.98,base+w*0.025],fill=255)
cont=gaussian_filter(np.asarray(img,float)/255,N*0.004)*0.55
occl=gaussian_filter(np.asarray(img,float)/255,N*0.014)*0.22
sh=np.clip(cast_m+cont+occl,0,0.75)[...,None]
PLUM=np.array([64,44,50],float)
B=np.asarray(bg,float)
B=B*(1-sh)+ (B*PLUM/255*1.1)*sh   # multiply-ish toward plum, keeps texture
canvas=Image.fromarray(np.clip(B,0,255).astype('uint8')).convert('RGBA')
canvas.alpha_composite(cut,(x,y))
canvas.convert('RGB').resize((1600,1600),Image.LANCZOS).save(out,quality=92)
print(out,'box',x,y,w,h)
