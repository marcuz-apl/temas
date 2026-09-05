import pytest
from fastapi.testclient import TestClient
from backend.main import app, ADMIN_KEY
from backend.database import init_db

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    init_db()

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "TEMAS-2.1"

def test_earthquakes_list():
    res = client.get("/api/earthquakes?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert len(data["items"]) <= 10
    if data["items"]:
        item = data["items"][0]
        assert "magnitude" in item
        assert "latitude" in item
        assert "longitude" in item
        assert "region" in item
        assert isinstance(item["latitude"], (float, int))
        assert isinstance(item["longitude"], (float, int))

def test_earthquakes_filter():
    res = client.get("/api/earthquakes?min_magnitude=4.5&limit=5")
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["magnitude"] >= 4.5

    # Filter by measurement source
    res_source = client.get("/api/earthquakes?measmethod=EMSC&limit=5")
    assert res_source.status_code == 200
    for item in res_source.json()["items"]:
        assert "EMSC" in item["measmethod"]

    # Filter by scale (magtype)
    res_scale = client.get("/api/earthquakes?magtype=ML&limit=5")
    assert res_scale.status_code == 200
    for item in res_scale.json()["items"]:
        assert item["magtype"].upper() == "ML"

    # Filter by region
    res_reg = client.get("/api/earthquakes?region=Izmir&limit=5")
    assert res_reg.status_code == 200
    for item in res_reg.json()["items"]:
        assert "izmir" in item["region"].lower()

def test_stats():
    res = client.get("/api/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_count" in data
    assert data["total_count"] >= 2000
    assert "max_magnitude" in data
    assert "avg_depth" in data

def test_boundaries_tectonic():
    res = client.get("/api/boundaries/tectonic")
    assert res.status_code == 200
    data = res.json()
    assert "type" in data
    assert data["type"] == "FeatureCollection"

def test_boundaries_provinces():
    res = client.get("/api/boundaries/provinces")
    assert res.status_code == 200
    data = res.json()
    assert "type" in data
    assert data["type"] == "FeatureCollection"

def test_frontend_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "TEMAS" in res.text
    assert "Turkey Earthquake Monitoring" in res.text

    res_css = client.get("/static/css/style.css")
    assert res_css.status_code == 200
    assert "--bg-dark" in res_css.text

    res_js = client.get("/static/js/app.js")
    assert res_js.status_code == 200
    assert "TemasApp" in res_js.text

def test_admin_frontend_serving():
    res = client.get("/admin")
    assert res.status_code == 200
    assert "Observatory Operations Deck" in res.text
    assert "authModal" in res.text
    assert "syncResultModal" in res.text

    res_admin_css = client.get("/static/css/admin.css")
    assert res_admin_css.status_code == 200

    res_admin_js = client.get("/static/js/admin.js")
    assert res_admin_js.status_code == 200

def test_admin_purge_noise():
    res = client.post("/api/admin/db/purge-noise?min_mag=2.0", headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "purged_records" in data


# ==========================================
# ADMIN & MULTI-SOURCE TESTS
# ==========================================

def test_admin_auth_protection():
    # Unauthorized without header
    res = client.get("/api/admin/status")
    assert res.status_code == 401

    # Unauthorized with wrong key
    res_wrong = client.get("/api/admin/status", headers={"X-Admin-Key": "wrong-key"})
    assert res_wrong.status_code == 401

    # Authorized with valid key
    res_ok = client.post("/api/admin/auth", headers={"X-Admin-Key": ADMIN_KEY})
    assert res_ok.status_code == 200
    assert res_ok.json()["status"] == "authenticated"

def test_admin_status_telemetry():
    res = client.get("/api/admin/status", headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200
    data = res.json()
    assert "providers" in data
    assert "koeri" in data["providers"]
    assert "emsc" in data["providers"]
    assert "usgs" in data["providers"]
    assert "database" in data
    assert "by_year" in data["database"]
    assert "magnitude_distribution" in data["database"]

def test_admin_vacuum():
    res = client.post("/api/admin/db/vacuum", headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "after_mb" in data


def test_admin_checkpoint_wal():
    res = client.post("/api/admin/db/checkpoint-wal", headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "wal_after_mb" in data
    assert data["wal_after_mb"] == 0.0


def test_admin_deduplicate():
    res = client.post("/api/admin/db/deduplicate", headers={"X-Admin-Key": ADMIN_KEY})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "purged_duplicates" in data
    assert "remaining_unique" in data

def test_admin_manual_event_lifecycle():
    event_payload = {
        "origintimeutc": "2024-06-15 14:30:00",
        "magnitude": 4.8,
        "magtype": "MW",
        "latitude": 38.1234,
        "longitude": 36.5678,
        "depthkm": 7.5,
        "region": "TEST-OBSERVATORY-REGION",
        "measmethod": "MANUAL-OPERATOR",
        "attribute": "VERIFIED-REVIEWED"
    }
    # Create
    res_create = client.post("/api/admin/earthquakes", json=event_payload, headers={"X-Admin-Key": ADMIN_KEY})
    assert res_create.status_code in [200, 201]

    # Verify present
    res_query = client.get("/api/earthquakes?region=TEST-OBSERVATORY-REGION")
    assert res_query.status_code == 200
    items = res_query.json()["items"]
    assert len(items) >= 1
    assert items[0]["magnitude"] == 4.8

    # Delete
    del_payload = {
        "origintimeutc": "2024-06-15 14:30:00",
        "latitude": 38.1234,
        "longitude": 36.5678
    }
    res_del = client.request("DELETE", "/api/admin/earthquakes", json=del_payload, headers={"X-Admin-Key": ADMIN_KEY})
    assert res_del.status_code == 200
    assert res_del.json()["deleted"] is True


def test_admin_change_password():
    # 1. Incorrect current password rejected
    res_bad = client.post(
        "/api/admin/change-password",
        json={"current_password": "wrong-password", "new_password": "newpassword123"},
        headers={"X-Admin-Key": ADMIN_KEY}
    )
    assert res_bad.status_code == 400

    # 2. Successfully change password
    res_change = client.post(
        "/api/admin/change-password",
        json={"current_password": ADMIN_KEY, "new_password": "updatedpass2026!"},
        headers={"X-Admin-Key": ADMIN_KEY}
    )
    assert res_change.status_code == 200
    assert res_change.json()["status"] == "success"

    # 3. Old password now rejected for admin actions
    res_old = client.get("/api/admin/status", headers={"X-Admin-Key": ADMIN_KEY})
    assert res_old.status_code == 401

    # 4. New password accepted for admin actions
    res_new = client.get("/api/admin/status", headers={"X-Admin-Key": "updatedpass2026!"})
    assert res_new.status_code == 200

    # 5. Revert back to default ADMIN_KEY
    res_revert = client.post(
        "/api/admin/change-password",
        json={"current_password": "updatedpass2026!", "new_password": ADMIN_KEY},
        headers={"X-Admin-Key": "updatedpass2026!"}
    )
    assert res_revert.status_code == 200
    assert res_revert.json()["status"] == "success"


@pytest.mark.anyio
async def test_emsc_fetch():
    from backend.ingestion.emsc import fetch_emsc_earthquakes
    quakes = await fetch_emsc_earthquakes(min_mag=3.5, limit=3)
    assert isinstance(quakes, list)
    if quakes:
        q = quakes[0]
        assert "origintimeutc" in q
        assert "magnitude" in q
        assert q["magnitude"] >= 3.5
        assert "measmethod" in q
        assert "EMSC" in q["measmethod"]

@pytest.mark.anyio
async def test_usgs_fetch():
    from backend.ingestion.usgs import fetch_usgs_earthquakes
    quakes = await fetch_usgs_earthquakes()
    assert isinstance(quakes, list)
