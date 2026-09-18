"""Cart service with stock validation."""

from app.extensions import db
from app.models import CartItem, Product
from app.services.product_service import ProductServiceError, get_product


class CartServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _parse_quantity(raw) -> int:
    try:
        qty = int(raw)
    except (TypeError, ValueError) as exc:
        raise CartServiceError("quantity must be an integer") from exc
    if qty <= 0:
        raise CartServiceError("quantity must be greater than 0")
    return qty


def add_to_cart(data: dict) -> dict:
    if not data:
        raise CartServiceError("JSON body required")

    user_id = data.get("user_id")
    product_id = data.get("product_id")
    if user_id is None or str(user_id).strip() == "":
        raise CartServiceError("user_id is required")
    if product_id is None:
        raise CartServiceError("product_id is required")
    if "quantity" not in data:
        raise CartServiceError("quantity is required")

    user_id = str(user_id).strip()
    try:
        product_id = int(product_id)
    except (TypeError, ValueError) as exc:
        raise CartServiceError("product_id must be an integer") from exc

    quantity = _parse_quantity(data["quantity"])

    try:
        product = get_product(product_id)
    except ProductServiceError as exc:
        raise CartServiceError(exc.message, exc.status_code) from exc

    existing = CartItem.query.filter_by(user_id=user_id, product_id=product_id).first()
    new_qty = quantity if not existing else existing.quantity + quantity

    if new_qty > product.stock:
        raise CartServiceError(
            f"insufficient stock: available={product.stock}, requested={new_qty}"
        )

    if existing:
        existing.quantity = new_qty
        item = existing
    else:
        item = CartItem(user_id=user_id, product_id=product_id, quantity=quantity)
        db.session.add(item)

    db.session.commit()
    return item.to_dict()


def get_cart(user_id: str) -> dict:
    user_id = str(user_id).strip()
    items = CartItem.query.filter_by(user_id=user_id).order_by(CartItem.id).all()
    return {
        "user_id": user_id,
        "items": [i.to_dict() for i in items],
        "item_count": len(items),
    }


def remove_cart_item(user_id: str, product_id: int) -> None:
    user_id = str(user_id).strip()
    item = CartItem.query.filter_by(user_id=user_id, product_id=product_id).first()
    if not item:
        raise CartServiceError(
            f"Cart item for user={user_id} product={product_id} not found", 404
        )
    db.session.delete(item)
    db.session.commit()
