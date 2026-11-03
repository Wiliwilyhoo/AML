import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import pandas as pd
from app.data import sample_rows

parser = argparse.ArgumentParser(description='Generate deterministic synthetic AML demo data, not real criminal labels.')
parser.add_argument('--rows', type=int, default=3000)
parser.add_argument('--seed', type=int, default=19)
parser.add_argument('--output', default='data/sample/transactions.csv')
args = parser.parse_args()
if not 1 <= args.rows <= 100000:
    parser.error('--rows must be between 1 and 100000')
path = Path(args.output)
path.parent.mkdir(parents=True, exist_ok=True)
pd.DataFrame(sample_rows(args.rows, args.seed)).to_csv(path, index=False)
print(f'Wrote {args.rows} synthetic transactions to {path}')
