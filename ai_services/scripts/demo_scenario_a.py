from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.demo_runner import main


if __name__ == "__main__":
    sys.argv = [sys.argv[0], "--bearing", "Bearing2_4", "--speed", "15", "--scenario", "a"]
    asyncio.run(main())
