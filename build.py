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

    # ວາງ CSS ແທນ <link>
    html = html.replace(
        '<link rel="stylesheet" href="assets/styles.css">',
        '<style>\n' + css + '\n</style>')

    # ວາງ JS ແທນ <script src>
    for src, code in (('assets/config.js', cfg), ('assets/app.js', app)):
        html = html.replace(
            f'<script src="{src}"></script>',
            '<script>\n' + code + '\n</script>')

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
