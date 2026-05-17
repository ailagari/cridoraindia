"""Map internal request to public UX labels (no state leakage)."""

from apps.accounts.models import CrossRedemptionRequest


def public_ux_status(req: CrossRedemptionRequest) -> str:
    """Instant | Fast | Processing | Completed | Failed"""
    if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.CLOSED:
        if req.outcome == CrossRedemptionRequest.Outcome.SUCCESS:
            return "Completed"
        return "Failed"
    if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.SETTLEMENT:
        return "Processing"
    if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.FULFILLMENT:
        return "Processing"
    if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.AUTH:
        if req.outcome == CrossRedemptionRequest.Outcome.FAILURE:
            return "Failed"
        if (req.ux_lane or "") == "delayed":
            return "Fast"
        return "Instant"
    return "Processing"
