"""Order / checkout service."""

from decimal import Decimal

from app.extensions import db
from app.models import CartItem, Order, OrderItem, Product


class OrderServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def create_order(data: dict) -> dict:
    if not data:
        raise OrderServiceError("JSON body required")
    user_id = data.get("user_id")
    if user_id is None or str(user_id).strip() == "":
        raise OrderServiceError("user_id is required")
    user_id = str(user_id).strip()

    cart_items = (
        CartItem.query.filter_by(user_id=user_id).order_by(CartItem.id).all()
    )
    if not cart_items:
        raise OrderServiceError("cart is empty")

    # Validate stock for all lines before mutating
    for item in cart_items:
        product = db.session.get(Product, item.product_id)
        if not product:
            raise OrderServiceError(
                f"product {item.product_id} no longer exists", 404
            )
        if item.quantity > product.stock:
            raise OrderServiceError(
                f"insufficient stock for product {product.id}: "
                f"available={product.stock}, requested={item.quantity}"
            )

    order = Order(user_id=user_id, status="placed", total=Decimal("0.00"))
    db.session.add(order)
    db.session.flush()

    total = Decimal("0.00")
    for item in cart_items:
        product = db.session.get(Product, item.product_id)
        unit_price = Decimal(str(product.price))
        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price=unit_price,
        )
        db.session.add(order_item)
        product.stock -= item.quantity
        total += unit_price * item.quantity

    order.total = total

    for item in cart_items:
        db.session.delete(item)

    db.session.commit()
    # Refresh relationship
    db.session.refresh(order)
    return order.to_dict()


def get_order(order_id: int) -> dict:
    order = db.session.get(Order, order_id)
    if not order:
        raise OrderServiceError(f"Order {order_id} not found", 404)
    return order.to_dict()
