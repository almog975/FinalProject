"""Product API tests."""


def test_create_and_list_products(client):
    resp = client.post(
        "/api/products",
        json={"name": "Widget", "price": 19.99, "stock": 10, "description": "A widget"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["name"] == "Widget"
    assert data["price"] == 19.99
    assert data["stock"] == 10
    assert "id" in data

    listed = client.get("/api/products")
    assert listed.status_code == 200
    items = listed.get_json()
    assert len(items) == 1
    assert items[0]["name"] == "Widget"


def test_update_and_delete_product(client):
    created = client.post(
        "/api/products", json={"name": "Gadget", "price": 5.0, "stock": 3}
    ).get_json()
    pid = created["id"]

    updated = client.put(
        f"/api/products/{pid}", json={"name": "Gadget Pro", "price": 7.5, "stock": 5}
    )
    assert updated.status_code == 200
    body = updated.get_json()
    assert body["name"] == "Gadget Pro"
    assert body["price"] == 7.5
    assert body["stock"] == 5

    deleted = client.delete(f"/api/products/{pid}")
    assert deleted.status_code == 204

    missing = client.put(f"/api/products/{pid}", json={"name": "x"})
    assert missing.status_code == 404


def test_create_product_validation(client):
    resp = client.post("/api/products", json={"name": "x"})
    assert resp.status_code == 400
    assert "error" in resp.get_json()
