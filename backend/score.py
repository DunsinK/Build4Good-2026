"""
Pickleball Score Helper — MVP point-winner logic.

Determines which side gets the point when a rally-ending event occurs
and produces the minimal audio_text string for the frontend.

This module intentionally does NOT implement full pickleball scoring
(serve tracking, doubles server rotation, game-to-11, etc.). It is a
thin, stateless helper that the backend calls once per rally-end event.
Full scoring can be layered on top later.

Supported rally-end reasons:
  - ball_out       → ball landed outside court boundaries
  - second_bounce  → ball bounced twice on the same side
  - fault          → placeholder for serve/kitchen violations
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

VALID_SIDES = {"left", "right"}
VALID_REASONS = {"ball_out", "second_bounce", "fault"}


def determine_point_winner(event: dict) -> dict:
    """Decide who gets the point from a rally-ending event.

    Parameters
    ----------
    event : dict
        Must contain at least::

            {
                "event_type":      "rally_end",
                "reason":          "ball_out" | "second_bounce" | "fault",
                "bounce_side":     "left" | "right",
                "point_candidate": "left" | "right" | None,
            }

    Returns
    -------
    dict ::

        {
            "point_awarded_to": "left" | "right" | None,
            "audio_text":       "left got the point" | "right got the point" | None,
            "reason":           str | None,
        }
    """
    if not event or event.get("event_type") != "rally_end":
        return _no_point()

    reason = event.get("reason")
    candidate = event.get("point_candidate")

    if reason not in VALID_REASONS:
        logger.warning("Unknown rally-end reason: %s — no point awarded", reason)
        return _no_point()

    if candidate not in VALID_SIDES:
        logger.warning("Invalid point_candidate: %s — no point awarded", candidate)
        return _no_point()

    logger.info(
        "Point awarded to %s (reason: %s, bounce_side: %s)",
        candidate,
        reason,
        event.get("bounce_side"),
    )
    return {
        "point_awarded_to": candidate,
        "audio_text": f"{candidate} got the point",
        "reason": reason,
    }


def _no_point() -> dict:
    return {
        "point_awarded_to": None,
        "audio_text": None,
        "reason": None,
    }
