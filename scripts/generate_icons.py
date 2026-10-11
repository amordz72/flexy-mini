"""Generate dependency-free PNG PWA icons for Flexy Mini."""
import os, struct, zlib
def chunk(kind,data):
    return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
def make(size,maskable=False):
    pixels=bytearray()
    inset=int(size*(0.16 if maskable else 0.08))
    for y in range(size):
        pixels.append(0)
        for x in range(size):
            base=(37,99,235,255)
            if inset<=x<size-inset and inset<=y<size-inset:
                # White stylized lightning glyph, inside a safe-area square
                u=(x-inset)/(size-2*inset);v=(y-inset)/(size-2*inset)
                lightning=((0.47<=u<=0.69 and 0.16<=v<=0.48) or (0.31<=u<=0.53 and 0.52<=v<=0.84) or (0.30<=u<=0.70 and abs(v-(0.83-0.92*u))<0.115))
                if lightning:base=(255,255,255,255)
            pixels.extend(base)
    raw=zlib.compress(bytes(pixels),9)
    png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0))+chunk(b"IDAT",raw)+chunk(b"IEND",b"")
    path=f"public/icons/icon-{'maskable-' if maskable else ''}{size}.png"
    os.makedirs(os.path.dirname(path),exist_ok=True)
    with open(path,"wb") as file:file.write(png)
for s,m in [(192,False),(512,False),(512,True)]:make(s,m)
