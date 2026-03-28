"""
Pickleball AI Referee — Frame-by-frame ML inference engine.

Stateful pipeline that processes one BGR frame at a time and maintains
session state (ball trajectory, court geometry, rally status) across
frames. Returns structured dicts consumed by the backend orchestrator.

Pipeline steps (see process_frame):
  1. Increment frame counter
  2. Preprocess frame              → _preprocess_frame
  3. Detect / update court state   → _detect_court
  4. Detect ball via YOLO          → _detect_ball_with_yolo
  5. Append to trajectory history  → _update_ball_history
  6. Estimate bounce candidate     → _detect_bounce
  7. Determine provisional call    → _determine_call
  8. Generate rally-end event      → _evaluate_rally_event
  9. Return structured result      → _build_tracking_result / _build_decision_result

Responsibility split:
  - YOLO  → ball detection, position, confidence
  - OpenCV → preprocessing, court lines, trajectory tracking,
             bounce detection, in/out classification, event generation
"""

from __future__ import annotations

import time
import random
import logging
from dataclasses import dataclass
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Data classes
# ------------------------------------------------------------------

@dataclass
class BallPosition:
    x: int
    y: int
    confidence: float
    timestamp: float


@dataclass
class BounceEvent:
    position: BallPosition
    call: str           # "IN" | "OUT"
    confidence: float
    frame_index: int


# ------------------------------------------------------------------
# Engine
# ------------------------------------------------------------------

class PickleballRefereeEngine:
    """Real-time pickleball referee that processes video one frame at a time.

    One instance is created per WebSocket session and kept alive for the
    duration of the connection so state accumulates across frames.

    Usage::

        engine = PickleballRefereeEngine()
        result = engine.process_frame(cv2_bgr_frame)
    """

    MAX_HISTORY = 120       # ~4 s at 30 fps
    BOUNCE_COOLDOWN = 15    # min frames between two bounce detections

    def __init__(self) -> None:
        self.frame_index: int = 0
        self.ball_history: list[BallPosition] = []
        self.court_polygon: Optional[np.ndarray] = None
        self.court_detected: bool = False
        self.court_center_x: int = 0
        self.last_bounce: Optional[BounceEvent] = None
        self.last_call: Optional[str] = None
        self.rally_active: bool = True
        self.last_bounce_side: Optional[str] = None
        self.bounce_count_left: int = 0
        self.bounce_count_right: int = 0
        self._frames_since_bounce: int = 999

        logger.info("PickleballRefereeEngine initialised")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process_frame(self, frame: np.ndarray) -> dict:
        """Run the full inference pipeline on a single BGR frame.

        Steps:
          1. Increment frame_index
          2. Preprocess frame
          3. Detect or update court state
          4. Detect ball using YOLO placeholder
          5. Append ball position to history if found
          6. Estimate bounce candidate from trajectory
          7. Determine provisional call (IN / OUT / null)
          8. Generate event candidate if rally should end
          9. Return structured result dict
        """
        # 1. Increment frame counter
        self.frame_index += 1
        self._frames_since_bounce += 1

        # 2. Preprocess
        preprocessed = self._preprocess_frame(frame)

        # 3. Court detection / update
        self._detect_court(preprocessed)

        # 4. Ball detection (YOLO)
        ball_pos = self._detect_ball_with_yolo(preprocessed)

        # 5. Update trajectory history
        if ball_pos is not None:
            self._update_ball_history(ball_pos)

        # 6. Bounce detection
        bounce_detected, bounce_confidence = self._detect_bounce()

        # 7. Provisional call + side determination
        call: Optional[str] = None
        bounce_side: Optional[str] = None
        if bounce_detected and ball_pos is not None:
            call = self._determine_call(ball_pos)
            bounce_side = self._determine_ball_side(ball_pos)
            self._record_bounce(ball_pos, call, bounce_confidence, bounce_side)

        # 8. Rally-end event evaluation
        event: Optional[dict] = None
        if bounce_detected and bounce_side is not None:
            event = self._evaluate_rally_event(call, bounce_side)

        # 9. Build and return result
        if event is not None:
            self.rally_active = False
            return self._build_decision_result(
                ball_pos, bounce_confidence, call, event,
            )

        return self._build_tracking_result(
            ball_pos, bounce_detected, bounce_confidence, call,
        )

    def reset_rally(self) -> None:
        """Called by the backend after a point is awarded to prepare for
        the next rally."""
        self.rally_active = True
        self.last_call = None
        self.last_bounce_side = None
        self.bounce_count_left = 0
        self.bounce_count_right = 0
        self.ball_history.clear()
        self._frames_since_bounce = 999

    # ------------------------------------------------------------------
    # Step 2 — Preprocessing (OpenCV)
    # ------------------------------------------------------------------

    def _preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Normalise the raw camera frame before running detection.

        TODO: Add real preprocessing
          - White-balance correction for outdoor/indoor lighting
          - Contrast-limited adaptive histogram equalisation (CLAHE)
          - Gaussian blur to reduce noise
          - Resize to YOLO model input dimensions (e.g. 640×640)
        """
        return frame

    # ------------------------------------------------------------------
    # Step 3 — Court detection (OpenCV)
    # ------------------------------------------------------------------

    def _detect_court(self, frame: np.ndarray) -> None:
        """Detect or update the court boundary polygon.

        Only runs full detection on the first frame. On subsequent frames
        the cached polygon is reused.

        TODO: Replace with real court detection
          - Convert to HSV / Canny edge map
          - Hough line transform or U-Net segmentation model
          - Identify baseline, sidelines, kitchen (NVZ) line
          - Fit convex polygon for point-in-polygon tests
          - Compute homography matrix for perspective correction
          - Optionally re-detect every N frames to handle camera drift
        """
        if self.court_detected:
            return

        h, w = frame.shape[:2]
        mx, my = int(w * 0.1), int(h * 0.15)
        self.court_polygon = np.array([
            [mx, my], [w - mx, my],
            [w - mx, h - my], [mx, h - my],
        ], dtype=np.int32)
        self.court_center_x = w // 2
        self.court_detected = True
        logger.info("Court detected (placeholder polygon, center_x=%d)", self.court_center_x)

    # ------------------------------------------------------------------
    # Step 4 — Ball detection (YOLO)
    # ------------------------------------------------------------------

    def _detect_ball_with_yolo(self, frame: np.ndarray) -> Optional[BallPosition]:
        """Run YOLO inference to locate the pickleball in the frame.

        TODO: Replace with real YOLO inference
          - Load YOLOv8/v11 model fine-tuned on pickleball dataset
          - Run model.predict(frame) with confidence threshold ~0.4
          - Filter detections by class ID (pickleball)
          - Apply NMS and return highest-confidence detection
          - Fall back to colour-blob tracker (HSV mask) when YOLO misses
          - Cache model instance in __init__ to avoid reload per frame
        """
        h, w = frame.shape[:2]
        if random.random() < 0.85:
            cx = int(w * 0.3 + random.gauss(0, w * 0.05))
            cy = int(h * 0.4 + random.gauss(0, h * 0.03))
            cx = max(0, min(w - 1, cx))
            cy = max(0, min(h - 1, cy))
            conf = round(random.uniform(0.70, 0.99), 4)
            return BallPosition(x=cx, y=cy, confidence=conf, timestamp=time.time())
        return None

    # ------------------------------------------------------------------
    # Step 5 — Trajectory history
    # ------------------------------------------------------------------

    def _update_ball_history(self, pos: BallPosition) -> None:
        """Append a detected position to the rolling trajectory buffer."""
        self.ball_history.append(pos)
        if len(self.ball_history) > self.MAX_HISTORY:
            self.ball_history = self.ball_history[-self.MAX_HISTORY:]

    # ------------------------------------------------------------------
    # Step 6 — Bounce detection (OpenCV / trajectory analysis)
    # ------------------------------------------------------------------

    def _detect_bounce(self) -> tuple[bool, float]:
        """Analyse recent trajectory to detect a bounce candidate.

        Only fires when the rally is active and enough frames have
        passed since the last bounce (cooldown prevents duplicates).

        TODO: Replace with real bounce detection
          - Compute vertical velocity (dy/dt) from ball_history timestamps
          - Detect sign change in dy (downward → upward)
          - Require minimum arc height to filter noise
          - Use acceleration thresholds to reduce false positives
          - Return calibrated confidence from model or heuristic

        Returns (bounce_detected, confidence).
        """
        if not self.rally_active:
            return False, 0.0
        if self._frames_since_bounce <= self.BOUNCE_COOLDOWN:
            return False, 0.0
        if len(self.ball_history) < 6:
            return False, 0.0

        recent = self.ball_history[-6:]
        dy = [recent[i + 1].y - recent[i].y for i in range(len(recent) - 1)]

        if len(dy) >= 3 and dy[-3] > 0 and dy[-2] > 0 and dy[-1] < 0:
            conf = round(random.uniform(0.75, 0.98), 4)
            return True, conf

        return False, 0.0

    # ------------------------------------------------------------------
    # Step 7 — In / Out call (OpenCV)
    # ------------------------------------------------------------------

    def _determine_call(self, ball_pos: BallPosition) -> Optional[str]:
        """Determine whether the bounce landed IN or OUT of bounds.

        Uses cv2.pointPolygonTest against the cached court polygon.

        TODO: Improve in/out logic
          - Account for ball radius (~37 mm → pixel radius via homography)
          - Apply perspective correction before testing
          - Use signed distance for marginal calls + confidence weighting
          - Consider line width (ball touching line = IN)
        """
        if self.court_polygon is None:
            return None

        dist = cv2.pointPolygonTest(
            self.court_polygon.astype(np.float32),
            (float(ball_pos.x), float(ball_pos.y)),
            measureDist=False,
        )
        return "IN" if dist >= 0 else "OUT"

    def _determine_ball_side(self, ball_pos: BallPosition) -> str:
        """Which side of the court the ball is on (left / right)."""
        return "left" if ball_pos.x < self.court_center_x else "right"

    # ------------------------------------------------------------------
    # Internal — bounce bookkeeping
    # ------------------------------------------------------------------

    def _record_bounce(
        self,
        ball_pos: BallPosition,
        call: Optional[str],
        confidence: float,
        bounce_side: str,
    ) -> None:
        """Store bounce metadata and update per-side counters."""
        self.last_call = call
        self.last_bounce = BounceEvent(
            position=ball_pos,
            call=call or "IN",
            confidence=confidence,
            frame_index=self.frame_index,
        )
        self._frames_since_bounce = 0

        if bounce_side == self.last_bounce_side:
            if bounce_side == "left":
                self.bounce_count_left += 1
            else:
                self.bounce_count_right += 1
        else:
            self.bounce_count_left = 1 if bounce_side == "left" else 0
            self.bounce_count_right = 1 if bounce_side == "right" else 0
        self.last_bounce_side = bounce_side

    # ------------------------------------------------------------------
    # Step 8 — Rally event evaluation
    # ------------------------------------------------------------------

    def _evaluate_rally_event(
        self, call: Optional[str], bounce_side: str,
    ) -> Optional[dict]:
        """Decide whether the current bounce ends the rally.

        MVP rally-ending conditions:
          1. ball_out       — ball bounced outside the court
          2. second_bounce  — ball bounced twice on the same side
          3. fault          — placeholder for future rule violations

        Point logic (side-based):
          - Event on left side  → right gets the point
          - Event on right side → left gets the point

        TODO: Expand event detection
          - Detect faults (serve into net, foot fault, kitchen violation)
          - Use ball trajectory + player positions for net detection
        """
        opposite = "right" if bounce_side == "left" else "left"

        if call == "OUT":
            return {
                "event_type": "rally_end",
                "reason": "ball_out",
                "bounce_side": bounce_side,
                "point_candidate": opposite,
            }

        count = self.bounce_count_left if bounce_side == "left" else self.bounce_count_right
        if count >= 2:
            return {
                "event_type": "rally_end",
                "reason": "second_bounce",
                "bounce_side": bounce_side,
                "point_candidate": opposite,
            }

        # TODO: fault detection
        # if self._detect_fault(bounce_side):
        #     return {"event_type": "rally_end", "reason": "fault", ...}

        return None

    # ------------------------------------------------------------------
    # Step 9 — Result builders
    # ------------------------------------------------------------------

    def _build_tracking_result(
        self,
        ball_pos: Optional[BallPosition],
        bounce_detected: bool,
        confidence: float,
        call: Optional[str],
    ) -> dict:
        """Build a type="tracking" response for a normal frame."""
        ball_detected = ball_pos is not None
        message = None
        if bounce_detected and call:
            message = f"Bounce detected — {call}"
        elif not ball_detected:
            message = "Ball not detected"

        return {
            "type": "tracking",
            "frame_index": self.frame_index,
            "ball_detected": ball_detected,
            "ball_position": {"x": ball_pos.x, "y": ball_pos.y} if ball_pos else None,
            "court_detected": self.court_detected,
            "bounce_detected": bounce_detected,
            "call": call,
            "event": None,
            "confidence": round(confidence, 4),
            "message": message,
        }

    def _build_decision_result(
        self,
        ball_pos: Optional[BallPosition],
        confidence: float,
        call: Optional[str],
        event: dict,
    ) -> dict:
        """Build a type="decision" response for a rally-ending frame."""
        reason = event.get("reason", "unknown")
        winner = event.get("point_candidate", "unknown")

        return {
            "type": "decision",
            "frame_index": self.frame_index,
            "ball_detected": ball_pos is not None,
            "ball_position": {"x": ball_pos.x, "y": ball_pos.y} if ball_pos else None,
            "court_detected": self.court_detected,
            "bounce_detected": True,
            "call": call,
            "event": event,
            "confidence": round(confidence, 4),
            "message": f"Rally ended ({reason}) — point candidate: {winner}",
        }
