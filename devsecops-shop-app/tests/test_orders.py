"""Order / checkout happy-path tests."""


def test_checkout_flow(client):
    # create product → add to cart → create order → get order
    product = client.post(
        "/api/products",
        json={"name": "Laptop", "price": 999.99, "stock": 5},
    ).get_json()

    cart_add = client.post(
        "/api/cart",
        json={"user_id": "alice", "product_id": product["id"], "quantity": 2},
    )
    assert cart_add.status_code == 201

    order_resp = client.post("/api/orders", json={"user_id": "alice"})
    assert order_resp.status_code == 201
    order = order_resp.get_json()
    assert order["user_id"] == "alice"
    assert order["status"] == "placed"
    assert order["total"] == 1999.98
    assert len(order["items"]) == 1
    assert order["items"][0]["quantity"] == 2
    assert order["items"][0]["unit_price"] == 999.99

    # Cart cleared
    cart = client.get("/api/cart/alice").get_json()
    assert cart["item_count"] == 0

    # Stock decremented
    products = client.get("/api/products").get_json()
    assert products[0]["stock"] == 3

    # Fetch order
    got = client.get(f"/api/orders/{order['id']}")
    assert got.status_code == 200
    assert got.get_json()["id"] == order["id"]


def test_order_empty_cart(client):
    resp = client.post("/api/orders", json={"user_id": "nobody"})
    assert resp.status_code == 400
    assert "empty" in resp.get_json()["error"]


def test_health_and_ready(client):
    assert client.get("/health").status_code == 200
    ready = client.get("/ready")
    assert ready.status_code == 200
    assert ready.get_json()["status"] == "ready"


def test_metrics(client):
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert b"flask_http" in resp.data or b"python_" in resp.data or b"#" in resp.data

