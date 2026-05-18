"""Map internal request to public UX labels (no state leakage)."""

from apps.accounts.models import CrossRedemptionRequest


def public_ux_status(req: CrossRedemptionRequest) -> str:
    """Instant | Fast | Processing | Completed | Failed | Awaiting approval"""
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
        if req.workflow_state == CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
            return "Awaiting approval"
        if (req.ux_lane or "") == "delayed":
            return "Fast"
        return "Instant"
    return "Processing"


def jeweller_inbox_status(req: CrossRedemptionRequest, *, party: str) -> str:
    if req.lifecycle_stage == CrossRedemptionRequest.LifecycleStage.CLOSED:
        return "Closed"
    if req.workflow_state == CrossRedemptionRequest.WorkflowState.AWAITING_SOURCE:
        return "Needs your approval" if party == "source" else "Waiting on source"
    if req.lifecycle_stage in (
        CrossRedemptionRequest.LifecycleStage.FULFILLMENT,
        CrossRedemptionRequest.LifecycleStage.SETTLEMENT,
    ):
        return "In progress"
    return public_ux_status(req)
