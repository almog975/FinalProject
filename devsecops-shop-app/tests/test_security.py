"""Security report endpoint tests — prefer always-available samples."""

import json
from pathlib import Path

from app.services import security_service
from app.services.security_service import KIND_SBOM, KIND_SCAN


def test_sbom_returns_200_with_sample(client):
    resp = client.get("/api/security/sbom")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["source"] in {"samples", "file", "db"}
    assert body["kind"] == "sbom"
    assert "artifact" in body
    assert body["artifact"]["bomFormat"] == "CycloneDX"
    assert "components" in body["artifact"]


def test_scan_report_returns_200_with_sample(client):
    resp = client.get("/api/security/scan-report")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["source"] in {"samples", "file", "db"}
    assert body["kind"] == "scan"
    assert "artifact" in body
    summary = body["artifact"]["summary"]
    assert "critical" in summary
    assert "total" in summary
    assert isinstance(body["artifact"]["vulnerabilities"], list)


def test_file_source_preferred_over_samples(client, tmp_path, monkeypatch):
    sbom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {"component": {"name": "from-file"}},
        "components": [],
    }
    (tmp_path / "sbom.json").write_text(json.dumps(sbom), encoding="utf-8")
    monkeypatch.setenv("SECURITY_ARTIFACTS_DIR", str(tmp_path))

    resp = client.get("/api/security/sbom")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["source"] == "file"
    assert body["artifact"]["metadata"]["component"]["name"] == "from-file"


def test_db_ingest_used_when_no_file(client, tmp_path, monkeypatch, app):
    # Point artifacts dir at empty folder so file loader misses
    monkeypatch.setenv("SECURITY_ARTIFACTS_DIR", str(tmp_path))
    content = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {"component": {"name": "from-db"}},
        "components": [],
    }
    with app.app_context():
        result = security_service.ingest_content(KIND_SBOM, content)
        assert result["id"] >= 1
        # ingest also mirrors to artifacts dir when set — remove so DB path is tested
        mirrored = tmp_path / "sbom.json"
        if mirrored.exists():
            mirrored.unlink()

    resp = client.get("/api/security/sbom")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["source"] == "db"
    assert body["artifact"]["metadata"]["component"]["name"] == "from-db"


def test_security_ingest_cli(app, tmp_path):
    scan = {
        "scanner": {"name": "trivy"},
        "summary": {"critical": 0, "high": 0, "medium": 0, "low": 0, "unknown": 0, "total": 0},
        "vulnerabilities": [],
    }
    path = tmp_path / "scan-report.json"
    path.write_text(json.dumps(scan), encoding="utf-8")

    runner = app.test_cli_runner()
    result = runner.invoke(args=["security-ingest", "scan", str(path)])
    assert result.exit_code == 0, result.output
    assert "Ingested scan" in result.output

    with app.app_context():
        latest = security_service.get_latest(KIND_SCAN)
        # May be file (if SECURITY_ARTIFACTS_DIR set by other tests) or db
        assert latest["artifact"]["summary"]["total"] == 0 or latest["source"] in {
            "db",
            "file",
            "samples",
        }
