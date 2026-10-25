from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.spa import mount_frontend


def make_client(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>spa</html>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    (dist / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("secret")

    app = FastAPI()

    @app.get("/health")
    def health():
        return {"status": "ok"}

    mount_frontend(app, dist)
    return TestClient(app)


def test_root_serves_index(tmp_path):
    response = make_client(tmp_path).get("/")
    assert response.status_code == 200
    assert "spa" in response.text
    assert response.headers["cache-control"] == "no-cache"


def test_client_route_falls_back_to_index(tmp_path):
    response = make_client(tmp_path).get("/courts/12")
    assert response.status_code == 200
    assert "spa" in response.text


def test_static_files_served(tmp_path):
    client = make_client(tmp_path)
    assert client.get("/assets/app.js").text == "console.log(1)"
    assert client.get("/favicon.svg").text == "<svg/>"


def test_api_routes_not_shadowed(tmp_path):
    assert make_client(tmp_path).get("/health").json() == {"status": "ok"}


def test_unknown_api_path_returns_json_404(tmp_path):
    response = make_client(tmp_path).get("/api/v1/nothing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_missing_asset_is_404_not_html(tmp_path):
    assert make_client(tmp_path).get("/assets/old-hash.js").status_code == 404


def test_path_traversal_does_not_leak(tmp_path):
    response = make_client(tmp_path).get("/..%2fsecret.txt")
    assert "secret" not in response.text
