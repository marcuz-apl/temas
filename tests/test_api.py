import pytest
from fastapi.testclient import TestClient
from backend.main import app
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
    assert data["service"] == "TEMAS-2.0"

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

def test_frontend_serving():
    res = client.get("/")
    assert res.status_code == 200
    assert "TEMAS 2.0" in res.text
    assert "Turkey Earthquake Monitoring" in res.text

    res_css = client.get("/static/css/style.css")
    assert res_css.status_code == 200
    assert "--bg-dark" in res_css.text

    res_js = client.get("/static/js/app.js")
    assert res_js.status_code == 200
    assert "TemasApp" in res_js.text
