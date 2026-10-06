#!/usr/bin/env python3

import os

from common import env_value, ok, phase, root_path

os.umask(0o077)


def main():
    phase("Cleaning up")
    removed = 0
    for key in ("BACKUP_DIR", "DEPLOYMENT_DIR"):
        folder = root_path(env_value(key) or key.lower())
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            if name.endswith(".tmp"):
                try:
                    os.remove(os.path.join(folder, name))
                    removed += 1
                except OSError:
                    pass
    ok(f"Cleanup done. Removed {removed} temporary files.")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
