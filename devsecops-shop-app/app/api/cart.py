"""Cart API resources."""

from flask import request
from flask_restful import Resource

from app.api.errors import error_response
from app.services import cart_service
from app.services.cart_service import CartServiceError


class CartResource(Resource):
    def post(self):
        try:
            item = cart_service.add_to_cart(request.get_json(silent=True))
            return item, 201
        except CartServiceError as exc:
            return error_response(exc.message, exc.status_code)


class CartUserResource(Resource):
    def get(self, user_id: str):
        return cart_service.get_cart(user_id), 200


class CartItemResource(Resource):
    def delete(self, user_id: str, product_id: int):
        try:
            cart_service.remove_cart_item(user_id, product_id)
            return "", 204
        except CartServiceError as exc:
            return error_response(exc.message, exc.status_code)
