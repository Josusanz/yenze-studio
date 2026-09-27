"""Build an auditable source distribution; never package runtime/customer data."""
from pathlib import Path
import zipfile
import json

root = Path(__file__).resolve().parent.parent
out = root / 'public/downloads/yenze-studio-source.zip'
files = ['package.json', 'package-lock.json', 'README.md', 'LICENSE', 'NOTICE.md', 'CONTRIBUTING.md', 'ROADMAP.md', 'SECURITY.md', '.env.example', '.gitignore', '.dockerignore', 'Dockerfile', 'render.yaml', 'index.html', 'tsconfig.json', 'vite.config.ts', 'playwright.config.ts', 'examples/README.md']
folders = ['core', 'server', 'src', 'tests', 'integrations', 'docs', 'scripts', '.github', 'public/brand', 'public/models', 'public/launch', 'deploy']
files += [str(p.relative_to(root)) for folder in folders for p in (root / folder).rglob('*') if p.is_file()]
files += [str(p.relative_to(root)) for p in (root / 'public').glob('*') if p.is_file()]
for name in files:
    path = root / name
    if path.is_symlink() or any(part in {'node_modules', 'data', 'dist', '__pycache__'} for part in path.relative_to(root).parts):
        raise SystemExit(f'Unsafe source path: {name}')
    if path.suffix in {'.sqlite', '.db', '.pem', '.key'} or (path.name.startswith('.env') and path.name != '.env.example'):
        raise SystemExit(f'Private file excluded: {name}')
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(set(files)):
        archive.write(root / name, 'yenze-studio/' + name)
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    assert 'yenze-studio/LICENSE' in archive.namelist()
print(json.dumps({'archive': str(out), 'files': len(set(files)), 'bytes': out.stat().st_size}))
