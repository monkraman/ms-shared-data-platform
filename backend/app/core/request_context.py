"""Request ID middleware and logging, so every log line carries the request and tenant."""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
tenant_id_var: ContextVar[str | None] = ContextVar("tenant_id", default=None)

REQUEST_ID_HEADER = "X-Request-ID"
_SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class RequestIdMiddleware:
    """Use the caller's X-Request-ID when it is safe, otherwise make one; echo it back."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope.get("headers") or []).get(REQUEST_ID_HEADER.lower().encode())
        candidate = incoming.decode("latin-1") if incoming else ""
        request_id = candidate if _SAFE_ID.match(candidate) else uuid.uuid4().hex
        rid_token = request_id_var.set(request_id)
        tid_token = tenant_id_var.set(None)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.encode(), request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            request_id_var.reset(rid_token)
            tenant_id_var.reset(tid_token)


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get() or "-"
        record.tenant_id = tenant_id_var.get() or "-"
        return True


def configure_logging(level: int = logging.INFO) -> None:
    """Add request and tenant IDs to every log line (idempotent)."""
    root = logging.getLogger()
    if any(isinstance(f, RequestContextFilter) for h in root.handlers for f in h.filters):
        return
    handler = logging.StreamHandler()
    handler.addFilter(RequestContextFilter())
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s request_id=%(request_id)s tenant_id=%(tenant_id)s %(message)s"
        )
    )
    root.addHandler(handler)
    root.setLevel(level)
