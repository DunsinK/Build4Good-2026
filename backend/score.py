"""
Pickleball Score Engine — In-memory game state and scoring logic.

Supports singles and doubles with standard pickleball rules:
  - Game to 11, win by 2
  - Only the serving side scores
  - Doubles: two serves per side-out (except game start)
"""

from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class GameMode(str, Enum):
    SINGLES = "singles"
    DOUBLES = "doubles"


class RallyResult(str, Enum):
    """Who won the rally — the serving side or the receiving side."""
    SERVER = "server"
    RECEIVER = "receiver"


@dataclass
class CallRecord:
    call: str              # "IN" | "OUT"
    confidence: float
    timestamp: float
    frame_index: int
    rally_winner: Optional[str] = None  # "server" | "receiver" | None if not yet resolved


class PickleballScoreEngine:
    """Manages a single pickleball game's score and serving state.

    Usage:
        engine = PickleballScoreEngine(mode=GameMode.DOUBLES)
        result = engine.record_rally(RallyResult.SERVER)
        state  = engine.get_state()
    """

    WIN_SCORE = 11
    WIN_MARGIN = 2

    def __init__(self, mode: GameMode = GameMode.SINGLES) -> None:
        self.mode = mode
        self.scores: list[int] = [0, 0]          # [side_0, side_1]
        self.serving_side: int = 0                # 0 or 1
        self.server_number: int = 2 if mode == GameMode.DOUBLES else 1
        self.game_over: bool = False
        self.winner: Optional[int] = None
        self.calls: list[CallRecord] = []
        self.rally_count: int = 0
        self.started_at: float = time.time()

        logger.info("Game started: %s", mode.value)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def record_rally(self, rally_winner: RallyResult) -> dict:
        """Record the outcome of a rally and update score/serving state.

        Returns a summary dict of what changed.
        """
        if self.game_over:
            return {"error": "Game is already over", **self.get_state()}

        self.rally_count += 1
        scored = False
        side_out = False
        prev_scores = self.scores.copy()
        prev_server = self.serving_side
        prev_server_num = self.server_number

        if rally_winner == RallyResult.SERVER:
            self.scores[self.serving_side] += 1
            scored = True
            if self._check_win(self.serving_side):
                self.game_over = True
                self.winner = self.serving_side
        else:
            side_out = self._handle_side_out()

        return {
            "scored": scored,
            "side_out": side_out,
            "point_for": self.serving_side if scored else None,
            "prev_scores": prev_scores,
            "prev_server": prev_server,
            "prev_server_number": prev_server_num,
            **self.get_state(),
        }

    def record_call(
        self,
        call: str,
        confidence: float,
        frame_index: int,
        rally_winner: Optional[str] = None,
    ) -> CallRecord:
        """Log an in/out call from the ML engine."""
        record = CallRecord(
            call=call,
            confidence=confidence,
            timestamp=time.time(),
            frame_index=frame_index,
            rally_winner=rally_winner,
        )
        self.calls.append(record)
        return record

    def correct_score(self, side_0: int, side_1: int) -> dict:
        """Manually override both scores."""
        self.scores = [side_0, side_1]
        self.game_over = False
        self.winner = None

        if self._check_win(0):
            self.game_over = True
            self.winner = 0
        elif self._check_win(1):
            self.game_over = True
            self.winner = 1

        logger.info("Score corrected to %s", self.scores)
        return self.get_state()

    def switch_server(self) -> dict:
        """Manually switch the serving side (forces a side-out)."""
        self._handle_side_out()
        logger.info("Server manually switched to side %d", self.serving_side)
        return self.get_state()

    def get_state(self) -> dict:
        """Return the full game state as a serialisable dict."""
        state = {
            "mode": self.mode.value,
            "scores": self.scores.copy(),
            "serving_side": self.serving_side,
            "game_over": self.game_over,
            "winner": self.winner,
            "rally_count": self.rally_count,
            "call_count": len(self.calls),
        }
        if self.mode == GameMode.DOUBLES:
            state["server_number"] = self.server_number
        state["score_display"] = self._format_score()
        return state

    def get_calls(self, last_n: Optional[int] = None) -> list[dict]:
        """Return call history, optionally limited to the last N entries."""
        calls = self.calls if last_n is None else self.calls[-last_n:]
        return [
            {
                "call": c.call,
                "confidence": round(c.confidence, 4),
                "timestamp": c.timestamp,
                "frame_index": c.frame_index,
                "rally_winner": c.rally_winner,
            }
            for c in calls
        ]

    def reset(self, mode: Optional[GameMode] = None) -> dict:
        """Reset the game. Optionally switch mode."""
        new_mode = mode or self.mode
        self.__init__(mode=new_mode)
        logger.info("Game reset: %s", new_mode.value)
        return self.get_state()

    # ------------------------------------------------------------------
    # Internal logic
    # ------------------------------------------------------------------

    def _handle_side_out(self) -> bool:
        """Process a side-out. Returns True if the serving side changed."""
        if self.mode == GameMode.SINGLES:
            self.serving_side = 1 - self.serving_side
            return True

        # Doubles: server #1 loses → move to server #2
        if self.server_number == 1:
            self.server_number = 2
            return False

        # Doubles: server #2 loses → full side-out
        self.serving_side = 1 - self.serving_side
        self.server_number = 1
        return True

    def _check_win(self, side: int) -> bool:
        """Check if the given side has won."""
        score = self.scores[side]
        other = self.scores[1 - side]
        return score >= self.WIN_SCORE and (score - other) >= self.WIN_MARGIN

    def _format_score(self) -> str:
        """Human-readable score string in standard pickleball format."""
        s = self.scores[self.serving_side]
        r = self.scores[1 - self.serving_side]

        if self.mode == GameMode.SINGLES:
            return f"{s}-{r}"

        return f"{s}-{r}-{self.server_number}"
