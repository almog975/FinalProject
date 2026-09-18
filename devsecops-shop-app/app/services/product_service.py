"""Product CRUD service."""

from decimal import Decimal, InvalidOperation

from app.extensions import db
from app.models import Product


class ProductServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def list_products() -> list[dict]:
    products = Product.query.order_by(Product.id).all()
    return [p.to_dict() for p in products]


def get_product(product_id: int) -> Product:
    product = db.session.get(Product, product_id)
    if not product:
        raise ProductServiceError(f"Product {product_id} not found", 404)
    return product


def _parse_price(raw) -> Decimal:
    try:
        price = Decimal(str(raw))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ProductServiceError("price must be a valid number") from exc
    if price <= 0:
        raise ProductServiceError("price must be greater than 0")
    return price


def _parse_stock(raw) -> int:
    try:
        stock = int(raw)
    except (TypeError, ValueError) as exc:
        raise ProductServiceError("stock must be an integer") from exc
    if stock < 0:
        raise ProductServiceError("stock must be >= 0")
    return stock


def create_product(data: dict) -> dict:
    if not data:
        raise ProductServiceError("JSON body required")
    name = data.get("name")
    if not name or not str(name).strip():
        raise ProductServiceError("name is required")
    if "price" not in data:
        raise ProductServiceError("price is required")
    if "stock" not in data:
        raise ProductServiceError("stock is required")

    product = Product(
        name=str(name).strip(),
        description=data.get("description"),
        price=_parse_price(data["price"]),
        stock=_parse_stock(data["stock"]),
    )
    db.session.add(product)
    db.session.commit()
    return product.to_dict()


def update_product(product_id: int, data: dict) -> dict:
    product = get_product(product_id)
    if not data:
        raise ProductServiceError("JSON body required")

    if "name" in data:
        name = data["name"]
        if not name or not str(name).strip():
            raise ProductServiceError("name cannot be empty")
        product.name = str(name).strip()
    if "description" in data:
        product.description = data["description"]
    if "price" in data:
        product.price = _parse_price(data["price"])
    if "stock" in data:
        product.stock = _parse_stock(data["stock"])

    db.session.commit()
    return product.to_dict()


def delete_product(product_id: int) -> None:
    product = get_product(product_id)
    db.session.delete(product)
    db.session.commit()
