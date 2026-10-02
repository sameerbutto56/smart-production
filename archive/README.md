# Enamels System Archive

This directory stores archived, legacy, and one-off diagnostic scripts that were previously placed in the root directory and `backend/`.

> [!CAUTION]
> **Do not run these scripts directly against production.**  
> Many of these files (`cleanup_db.js`, `reset_passwords.js`, `fix_stuck_*.js`) were historical single-use migration scripts written for specific data states. Running them against a live database can cause unintended state changes or data loss.

---

## Directory Structure

* **`legacy_backend_scripts/`**: 28 historical debug, seeding, and migration scripts moved from `backend/` (e.g., `_check2.js`, `check_db.js`, `cleanup_db.js`, `seed_logo_data.js`, `fix_inventory_categories.js`).
* **`legacy_root_scripts/`**: Historical root utility scripts previously in `scripts/` (e.g., `audit_active_orders.js`, `diagnose_delays.js`, `reconstruct_inventory.js`, `inventory_backup_2026-07-04.json`).
* **`smart-production-complete.zip`**: Legacy compressed backup snapshot from September 24, 2026.
