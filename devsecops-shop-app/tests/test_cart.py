"""Cart API tests."""


def _product(client, stock=10, price=9.99):
    return client.post(
        "/api/products",
        json={"name": "Item", "price": price, "stock": stock},
    ).get_json()


def test_add_get_remove_cart(client):
    product = _product(client)
    add = client.post(
        "/api/cart",
        json={"user_id": "u1", "product_id": product["id"], "quantity": 2},
    )
    assert add.status_code == 201
    assert add.get_json()["quantity"] == 2

    cart = client.get("/api/cart/u1")
    assert cart.status_code == 200
    body = cart.get_json()
    assert body["item_count"] == 1
    assert body["items"][0]["product_id"] == product["id"]

    removed = client.delete(f"/api/cart/u1/item/{product['id']}")
    assert removed.status_code == 204

    cart2 = client.get("/api/cart/u1").get_json()
    assert cart2["item_count"] == 0


def test_cart_stock_validation(client):
    product = _product(client, stock=2)
    resp = client.post(
        "/api/cart",
        json={"user_id": "u1", "product_id": product["id"], "quantity": 5},
    )
    assert resp.status_code == 400
    assert "insufficient stock" in resp.get_json()["error"]
