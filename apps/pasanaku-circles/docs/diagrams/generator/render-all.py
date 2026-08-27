"""
Render all Pasanaku diagrams to docs/diagrams/output/ (SVG + PNG).
Usage: python3 docs/diagrams/generator/render-all.py   (from app root)
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / "docs" / "diagrams" / "output"
OUTPUT.mkdir(parents=True, exist_ok=True)

scripts = [
    "01-system-architecture.py",
    "02-qr-contribution-flow.py",
    "03-circle-state-machine.py",
    "04-payment-verification.py",
    "05-round-lifecycle.py",
    "06-turn-order.py",
]

base = Path(__file__).parent
errors = []

for script in scripts:
    path = base / script
    result = subprocess.run(
        [sys.executable, str(path)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"\n✗ {script}\n{result.stderr}")
        errors.append(script)
    elif result.stdout:
        print(result.stdout.strip())

if errors:
    print(f"\n{len(errors)} script(s) failed: {errors}")
    sys.exit(1)

print(f"\nAll diagrams rendered → {OUTPUT}")
