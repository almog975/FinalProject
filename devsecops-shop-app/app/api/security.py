"""Security report endpoints — serve latest SBOM / scan artifacts."""

from flask_restful import Resource

from app.api.errors import error_response
from app.services import security_service
from app.services.security_service import KIND_SBOM, KIND_SCAN, SecurityServiceError


class SbomResource(Resource):
    def get(self):
        try:
            payload = security_service.get_latest(KIND_SBOM)
            return payload, 200
        except SecurityServiceError as exc:
            return error_response(exc.message, exc.status_code)


class ScanReportResource(Resource):
    def get(self):
        try:
            payload = security_service.get_latest(KIND_SCAN)
            return payload, 200
        except SecurityServiceError as exc:
            return error_response(exc.message, exc.status_code)
