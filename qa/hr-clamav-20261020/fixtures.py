"""Synthetic-only fixtures; requires pypdf==6.21.1. Output outside repository."""
import sys
from pathlib import Path
from pypdf import PdfWriter
root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
w = PdfWriter()
w.add_blank_page(width=72, height=72)
with (root / 'clean.pdf').open('wb') as f:
    w.write(f)
w.encrypt('synthetic-password')
with (root / 'encrypted.pdf').open('wb') as f:
    w.write(f)
(root / 'limit.pdf').write_bytes((root / 'clean.pdf').read_bytes() + b'\n' + b'0' * (2 * 1024 * 1024))
# Standard harmless antivirus test string; never uploaded to BPS/production.
(root / 'eicar.txt').write_bytes(b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$' + b'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')
