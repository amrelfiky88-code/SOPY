import sys, json, subprocess, os
from playwright.sync_api import sync_playwright
FPS=30
meta=json.load(open('meta.json'))
def snap(key, times, outdir='snaps'):
    os.makedirs(outdir,exist_ok=True)
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--allow-file-access-from-files'])
        pg=b.new_page(viewport={'width':1080,'height':1920})
        pg.goto('file://'+os.path.abspath(meta[key]['html'])); pg.evaluate('document.fonts.ready')
        for t in times:
            pg.evaluate(f'seek({t})'); pg.screenshot(path=f'{outdir}/{key}_{t:05.1f}.png')
        b.close()
def video(key):
    m=meta[key]; n=int(m['total']*FPS)
    os.makedirs('silent',exist_ok=True); out=f'silent/{key}.mp4'
    ff=subprocess.Popen(['ffmpeg','-loglevel','error','-y','-f','image2pipe','-framerate',str(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-r',str(FPS),out],stdin=subprocess.PIPE)
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--allow-file-access-from-files'])
        pg=b.new_page(viewport={'width':1080,'height':1920})
        pg.goto('file://'+os.path.abspath(m['html'])); pg.evaluate('document.fonts.ready')
        for i in range(n):
            pg.evaluate(f'seek({i/FPS})')
            ff.stdin.write(pg.screenshot(type='jpeg',quality=93))
        b.close()
    ff.stdin.close(); ff.wait(); print('done',key,n)
if __name__=='__main__':
    if sys.argv[1]=='snap':
        key=sys.argv[2]; snap(key,[float(x) for x in sys.argv[3:]])
    else:
        for k in sys.argv[2:]: video(k)
