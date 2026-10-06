#!/usr/bin/env python3

import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
os.chdir(ROOT)

import deploy


if __name__ == "__main__":
    sys.exit(deploy.main())
