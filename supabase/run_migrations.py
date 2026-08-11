#!/usr/bin/env python3
"""
run migration ໄປໃສ່ Supabase ໂດຍບໍ່ຕ້ອງມີ psql

ວິທີໃຊ້:
    export DATABASE_URL='postgresql://postgres.<ref>:<ລະຫັດ>@aws-0-<region>.pooler.supabase.com:5432/postgres'
    python3 supabase/run_migrations.py

ຫາ DATABASE_URL ໄດ້ທີ່:
    Supabase → Project Settings → Database → Connection string → URI

ຕົວເລືອກ:
    --dry-run     ພຽງແຕ່ແຍກຄຳສັ່ງໃຫ້ເບິ່ງ ບໍ່ຕໍ່ຖານຂໍ້ມູນ
    --file X.sql  run ສະເພາະໄຟລ໌ດຽວ
"""
import os
import re
import sys
import glob
import urllib.parse

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'migrations')


def split_statements(sql: str):
    """ແຍກ SQL ເປັນຄຳສັ່ງດ່ຽວໆ ໂດຍເຂົ້າໃຈ dollar-quote ($$…$$), string, ແລະ comment"""
    out, buf = [], []
    i, n = 0, len(sql)
    while i < n:
        ch = sql[i]

        # -- comment ຮອດທ້າຍແຖວ
        if ch == '-' and sql.startswith('--', i):
            j = sql.find('\n', i)
            j = n if j == -1 else j
            buf.append(sql[i:j])
            i = j
            continue

        # /* block comment */ (Postgres ຊ້ອນກັນໄດ້)
        if ch == '/' and sql.startswith('/*', i):
            depth, j = 1, i + 2
            while j < n and depth:
                if sql.startswith('/*', j):
                    depth, j = depth + 1, j + 2
                elif sql.startswith('*/', j):
                    depth, j = depth - 1, j + 2
                else:
                    j += 1
            buf.append(sql[i:j])
            i = j
            continue

        # 'string' — '' ຄືການ escape
        if ch == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2
                        continue
                    j += 1
                    break
                j += 1
            buf.append(sql[i:j])
            i = j
            continue

        # "identifier"
        if ch == '"':
            j = sql.find('"', i + 1)
            j = n if j == -1 else j + 1
            buf.append(sql[i:j])
            i = j
            continue

        # $tag$ … $tag$
        if ch == '$':
            m = re.match(r'\$[A-Za-z_]\w*\$|\$\$', sql[i:])
            if m:
                tag = m.group(0)
                j = sql.find(tag, i + len(tag))
                j = n if j == -1 else j + len(tag)
                buf.append(sql[i:j])
                i = j
                continue

        # ຈົບຄຳສັ່ງ
        if ch == ';':
            stmt = ''.join(buf).strip()
            if stmt:
                out.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = ''.join(buf).strip()
    if tail:
        out.append(tail)
    return out


def parse_url(url: str):
    u = urllib.parse.urlparse(url)
    if u.scheme not in ('postgres', 'postgresql'):
        raise SystemExit('DATABASE_URL ຕ້ອງຂຶ້ນຕົ້ນດ້ວຍ postgresql://')
    return {
        'user':     urllib.parse.unquote(u.username or 'postgres'),
        'password': urllib.parse.unquote(u.password or ''),
        'host':     u.hostname,
        'port':     u.port or 5432,
        'database': (u.path or '/postgres').lstrip('/') or 'postgres',
    }


def main():
    args    = sys.argv[1:]
    dry_run = '--dry-run' in args

    if '--file' in args:
        files = [args[args.index('--file') + 1]]
    else:
        files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, '*.sql')))

    if not files:
        raise SystemExit('ບໍ່ພົບໄຟລ໌ .sql ໃນ ' + MIGRATIONS_DIR)

    plan = [(f, split_statements(open(f, encoding='utf-8').read())) for f in files]

    for path, stmts in plan:
        print(f'  {os.path.basename(path)}: {len(stmts)} ຄຳສັ່ງ')

    if dry_run:
        print('\n--dry-run — ບໍ່ໄດ້ຕໍ່ຖານຂໍ້ມູນ')
        return

    url = os.environ.get('DATABASE_URL', '').strip()
    if not url:
        raise SystemExit(
            '\nຍັງບໍ່ໄດ້ຕັ້ງ DATABASE_URL\n'
            "  export DATABASE_URL='postgresql://postgres.<ref>:<ລະຫັດ>@…pooler.supabase.com:5432/postgres'")

    try:
        import pg8000.native
    except ImportError:
        raise SystemExit('ຕ້ອງຕິດຕັ້ງ driver ກ່ອນ:  python3 -m pip install pg8000')

    cfg = parse_url(url)
    print(f'\nກຳລັງຕໍ່ຫາ {cfg["host"]}:{cfg["port"]}/{cfg["database"]} …')
    conn = pg8000.native.Connection(ssl_context=True, **cfg)
    print('ຕໍ່ສຳເລັດ ✓\n')

    try:
        for path, stmts in plan:
            name = os.path.basename(path)
            print(f'──────── {name}')
            conn.run('begin')
            try:
                for k, stmt in enumerate(stmts, 1):
                    head = ' '.join(stmt.split())[:70]
                    try:
                        conn.run(stmt)
                        print(f'  [{k:>3}/{len(stmts)}] ✓ {head}')
                    except Exception as e:
                        print(f'  [{k:>3}/{len(stmts)}] ✗ {head}\n      {e}')
                        raise
                conn.run('commit')
                print(f'  ✅ {name} ສຳເລັດ\n')
            except Exception:
                conn.run('rollback')
                raise SystemExit(f'\n❌ {name} ລົ້ມເຫຼວ — ຍົກເລີກການປ່ຽນແປງທັງໝົດຂອງໄຟລ໌ນີ້ແລ້ວ')

        print('ກວດຜົນ:')
        rows = conn.run("""
            select table_type, table_name from information_schema.tables
            where table_schema = 'public' order by table_type, table_name""")
        for t, nm in rows:
            print(f'  {"ຕາຕະລາງ" if t == "BASE TABLE" else "view    "}  {nm}')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
