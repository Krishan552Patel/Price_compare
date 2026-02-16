# FAB Cards Database

Local scripts to manage a Turso database of Flesh and Blood TCG card data.
Data sourced from [the-fab-cube/flesh-and-blood-cards](https://github.com/the-fab-cube/flesh-and-blood-cards).

## Setup

1. Copy `.env.example` to `.env` and fill in your Turso credentials
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

```bash
# First run - inspect the data structure (no DB writes)
python ingest.py --inspect

# Sync latest release into your database
python ingest.py

# Force re-sync even if already up to date
python ingest.py --force

# Check database status and row counts
python ingest.py --status
```

## When New Cards Drop

1. Run `python ingest.py --status` to see if an update is available
2. Run `python ingest.py` to sync the new data
3. Retrain your ML model in Colab
