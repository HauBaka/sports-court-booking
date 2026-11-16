from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

TxType = Literal["TOPUP", "DEPOSIT", "REFUND", "FORFEIT", "SETTLE"]


class WalletTopupRequest(BaseModel):
    user_id: int = Field(..., ge=1)
    # Để Any: endpoint tự kiểm tra (0, âm, có phần lẻ, sai kiểu) và trả DEPOSIT_AMOUNT_INVALID
    amount: Any = Field(..., description="Số tiền cấp (VNĐ), số nguyên dương")
    reason: Optional[str] = Field(None, max_length=500)
