"""Security report stubs (Phase 2 will serve real SBOM / scan artifacts)."""

from flask_restful import Resource


class SbomResource(Resource):
    def get(self):
        # TODO: serve latest SBOM JSON from pipeline artifact / mounted volume
        return {
            "message": "TODO: SBOM not yet available — Phase 2 will wire Syft artifacts",
            "sbom": None,
        }, 404


class ScanReportResource(Resource):
    def get(self):
        # TODO: serve latest vulnerability scan summary from pipeline
        return {
            "message": "TODO: scan report not yet available — Phase 2 will wire Trivy/Grype",
            "report": None,
        }, 404
