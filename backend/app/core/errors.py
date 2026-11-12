"""One error format for the whole API: RFC 9457 problem details.

Body: ``{type, title, status, detail, instance, request_id}``; validation errors add
``errors`` (field-level messages the frontend shows next to each field).
"""

from __future__ import annotations

import logging
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import request_id_var

logger = logging.getLogger(__name__)

PROBLEM_JSON = "application/problem+json"


class ProblemError(Exception):
    """Raise from services or endpoints to return a problem-details error."""

    def __init__(
        self,
        status: int,
        detail: str,
        *,
        title: str | None = None,
        type_: str = "about:blank",
        extra: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.title = title or HTTPStatus(status).phrase
        self.type = type_
        self.extra = extra or {}
        self.headers = headers


def problem_response(
    request: Request,
    status: int,
    detail: Any,
    *,
    title: str | None = None,
    type_: str = "about:blank",
    extra: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {
        "type": type_,
        "title": title or HTTPStatus(status).phrase,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "request_id": request_id_var.get(),
    }
    if extra:
        body.update(extra)
    return JSONResponse(jsonable_encoder(body), status_code=status, media_type=PROBLEM_JSON, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemError)
    async def _problem(request: Request, exc: ProblemError) -> JSONResponse:
        return problem_response(
            request, exc.status, exc.detail, title=exc.title, type_=exc.type, extra=exc.extra, headers=exc.headers
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return problem_response(request, exc.status_code, exc.detail, headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Custom validators' messages are shown next to form fields as written.
        errors = [
            {
                "loc": list(e.get("loc", ())),
                "msg": str(e.get("msg", "")).removeprefix("Value error, "),
                "type": e.get("type"),
            }
            for e in exc.errors()
        ]
        return problem_response(
            request, 422, "The request has invalid fields.", title="Validation failed", extra={"errors": errors}
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return problem_response(request, 500, "An unexpected error occurred. Quote the request ID to support.")


def invalid_field(field: str, msg: str) -> ProblemError:
    """422 with one field error, shown next to that field in the UI (``toProblem().fields``)."""
    return invalid_fields({field: msg})


def invalid_fields(messages: dict[str, str]) -> ProblemError:
    """422 with one error per field."""
    return ProblemError(
        422,
        "The request has invalid fields.",
        extra={"errors": [{"loc": ["body", field], "msg": msg} for field, msg in messages.items()]},
    )
