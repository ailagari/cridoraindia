"""Cross-redemption domain errors (reason codes for API / logs)."""


class CrossRedemptionError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
