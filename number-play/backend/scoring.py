"""
Personalized Score = BaseScore × AttemptFactor × HintFactor × TimeFactor

Design principles:
  1. First-attempt correct with no hints is the gold standard (full score).
  2. Each retry and each hint significantly reduce the score — clear incentive
     to think before answering and avoid hint-dependency.
  3. Answering quickly (≤75% of expected time) earns a small speed bonus.
     Slow answers are penalised in stepped tiers.
  4. KC topic score only meaningfully advances on a correct answer.
     Wrong answers cause a small mastery decay (8%), not a hard reset.
     This reflects ITS pedagogy: wrong = evidence of weaker mastery,
     correct = evidence of stronger mastery — not a punishment system.

Factor tables
─────────────────────────────────────────────────────────────────────────────
AttemptFactor  1st → 1.00   2nd → 0.55   3rd → 0.25
               Steep drop to reward first-attempt fluency.

HintFactor     0 hints → 1.00   1 hint → 0.80
               2 hints → 0.60   3 hints → 0.40
               Each hint represents scaffolding — halving the credit over 3.

TimeFactor     ≤ 75% T    → 1.10  (speed bonus — fluency reward)
               ≤ T        → 1.00  (on time — full credit)
               ≤ 1.5× T   → 0.90  (slightly slow)
               ≤ 2.0× T   → 0.75  (slow)
               > 2.0× T   → 0.55  (very slow — struggled)

Score range (base = 10):
  Best:   10 × 1.00 × 1.00 × 1.10 = 11.0  (capped at 10)
  Typical 1st try, no hints, on time = 10.0
  2nd try, 1 hint, on time          =  5.5
  3rd try, 2 hints, slow            =  1.13
─────────────────────────────────────────────────────────────────────────────
"""

# ── Factor lookup tables ───────────────────────────────────────────────────

_ATTEMPT_FACTORS = {1: 1.00, 2: 0.55, 3: 0.25}
_HINT_FACTORS    = {0: 1.00, 1: 0.80, 2: 0.60, 3: 0.40}


def attempt_factor(attempts: int) -> float:
    return _ATTEMPT_FACTORS.get(min(attempts, 3), 0.25)


def hint_factor(hints_used: int) -> float:
    return _HINT_FACTORS.get(min(hints_used, 3), 0.40)


def time_factor(time_taken: int, expected_time: int) -> float:
    if expected_time <= 0:
        return 1.0
    ratio = time_taken / expected_time
    if ratio <= 0.75:
        return 1.10   # speed bonus: fast and correct = fluency
    elif ratio <= 1.00:
        return 1.00   # on time: full credit
    elif ratio <= 1.50:
        return 0.90   # slightly slow
    elif ratio <= 2.00:
        return 0.75   # slow
    else:
        return 0.55   # very slow: struggled significantly


def calculate_score(
    base_score: int,
    hints_used: int,
    time_taken: int,
    expected_time: int,
    attempts: int = 1,
) -> dict:
    af = attempt_factor(attempts)
    hf = hint_factor(hints_used)
    tf = time_factor(time_taken, expected_time)

    raw   = base_score * af * hf * tf
    score = round(min(raw, float(base_score)), 2)   # cap at base_score

    return {
        "score":          score,
        "attempt_factor": af,
        "hint_factor":    hf,
        "time_factor":    tf,
        "base_score":     base_score,
    }


def update_topic_score(
    current_score: float,
    score_earned: float,
    base_score: float,
    correct: bool,
) -> float:
    """
    Mastery-estimation KC score update.

    Correct answer
    ──────────────
    Normalise score_earned to a 0–100 performance percentage, then blend:
        new = 0.45 × current  +  0.55 × performance_pct
    Heavy weight on the new evidence — progress feels fast and real.

    Wrong answer
    ────────────
    Apply a small mastery decay (8%):
        new = 0.92 × current
    Reflects that a wrong attempt is evidence of weaker mastery, but
    is NOT catastrophic. Repeated wrong answers will gradually pull
    the score down, incentivising study without destroying motivation.
    """
    if not correct:
        return round(max(0.0, current_score * 0.92), 2)

    if base_score <= 0:
        return current_score

    performance_pct = min((score_earned / base_score) * 100.0, 100.0)
    new_score = 0.45 * current_score + 0.55 * performance_pct
    return round(max(0.0, min(100.0, new_score)), 2)
