"""
Pickleball Score Helper — MVP point-winner logic.

Determines which side gets the point when a rally-ending event occurs
and produces the minimal audio_text string for the frontend.

This module intentionally does NOT implement full pickleball scoring
(serve tracking, doubles server rotation, game-to-11, etc.). It is a
thin, stateless helper that the backend calls once per rally-end event.
Full scoring can be layered on top later.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

VALID_SIDES = {"left", "right"}


def determine_point_winner(event: dict) -> dict:
    """Decide who gets the point from a rally-ending event.

    Parameters
    ----------
    event : dict
        Must contain at least::

            {
                "event_type": "rally_end",
                "reason":     "ball_out" | "ball_in" | "second_bounce" | "fault",
                "point_candidate": "left" | "right" | None,
            }

    Returns
    -------
    dict
        ::

            {
                "point_awarded_to": "left" | "right" | None,
                "audio_text":       "left got the point" | "right got the point" | None,
            }
    """
    if not event or event.get("event_type") != "rally_end":
        return _no_point()

    candidate = event.get("point_candidate")

    if candidate not in VALID_SIDES:
        logger.warning("Invalid point_candidate: %s — no point awarded", candidate)
        return _no_point()

    logger.info("Point awarded to %s (reason: %s)", candidate, event.get("reason"))
    return {
        "point_awarded_to": candidate,
        "audio_text": f"{candidate} got the point",
    }


def _no_point() -> dict:
    return {
        "point_awarded_to": None,
        "audio_text": None,
    }
