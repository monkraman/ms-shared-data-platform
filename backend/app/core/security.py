"""Multi-tenant security context and request authorization."""

from typing import Optional
from fastapi import Header, Query, HTTPException, status


def get_current_tenant_id(
    x_tenant_id: Optional[str] = Header(None, description="Active tenant context header"),
    tenant_id: Optional[str] = Query(None, description="Optional tenant query override"),
) -> str:
    """Extract and validate the active tenant context.
    
    Defaults to 'khc-europe' if not specified for frictionless demo/PoV testing.
    """
    resolved_tenant = x_tenant_id or tenant_id or "khc-europe"
    
    # Check valid characters / basic sanity
    if not resolved_tenant or len(resolved_tenant) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or missing tenant identifier.",
        )
    return resolved_tenant.strip()
