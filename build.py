#!/usr/bin/env python3
"""
ລວມ index.html + styles.css + config.js + app.js ເປັນໄຟລ໌ HTML ດຽວ → dist/index.html

ໃຊ້ຕອນຢາກເອົາຂຶ້ນເວັບໂຮສທີ່ບໍ່ຮອງຮັບຫຼາຍໄຟລ໌ ຫຼື ຢາກສົ່ງໃຫ້ຄົນອື່ນງ່າຍໆ.
GitHub Pages ບໍ່ຕ້ອງໃຊ້ໄຟລ໌ນີ້ — ມັນຮັບໄຟລ໌ແຍກໄດ້ຢູ່ແລ້ວ.

    python3 build.py                    ໃຊ້ຄ່າໃນ assets/config.js
    python3 build.py --key <anon-key>   ໃສ່ anon key ຕອນ build ເລີຍ
"""
import os
import re
import sys
import json

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')

read = lambda *p: open(os.path.join(ROOT, *p), encoding='utf-8').read()


def main():
    html = read('index.html')
    css  = read('assets', 'styles.css')
    cfg  = read('assets', 'config.js')
    app  = read('assets', 'app.js')

    if '--key' in sys.argv:
        key = sys.argv[sys.argv.index('--key') + 1].strip()
        cfg = re.sub(r'SUPABASE_ANON_KEY:\s*"[^"]*"',
                     'SUPABASE_ANON_KEY: ' + json.dumps(key), cfg)
        print('ໃສ່ anon key ຕອນ build ແລ້ວ')

    # ວາງ CSS ແທນ <link>  (ຮັບ ?v=N ນຳ)
    html = re.sub(
        r'<link rel="stylesheet" href="assets/styles\.css(?:\?[^"]*)?">',
        lambda _: '<style>\n' + css + '\n</style>',
        html, count=1)

    # ວາງ JS ແທນ <script src>
    for name, code in (('config', cfg), ('app', app)):
        html, n = re.subn(
            r'<script src="assets/%s\.js(?:\?[^"]*)?"></script>' % name,
            lambda _, c=code: '<script>\n' + c + '\n</script>',
            html, count=1)
        if not n:
            raise SystemExit(f'ຫາ <script> ຂອງ assets/{name}.js ໃນ index.html ບໍ່ພົບ')

    left = re.findall(r'<(?:script src|link rel="stylesheet" href)="assets/[^"]+"', html)
    if left:
        raise SystemExit('ຍັງມີໄຟລ໌ທີ່ບໍ່ໄດ້ລວມ: ' + str(left))

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, 'index.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'✅ {out}  ({len(html.encode()) / 1024:.0f} KB, ໄຟລ໌ດຽວຈົບ)')
    print('   ເອົາໂຟນເດີ້ dist/ ໄປວາງໃສ່ເວັບໂຮສໃດກໍ່ໄດ້')


if __name__ == '__main__':
    main()
