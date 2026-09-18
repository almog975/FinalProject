"""Products API resources."""

from flask import request
from flask_restful import Resource

from app.api.errors import error_response
from app.services import product_service
from app.services.product_service import ProductServiceError


class ProductListResource(Resource):
    def get(self):
        return product_service.list_products(), 200

    def post(self):
        try:
            product = product_service.create_product(request.get_json(silent=True))
            return product, 201
        except ProductServiceError as exc:
            return error_response(exc.message, exc.status_code)


class ProductResource(Resource):
    def put(self, product_id: int):
        try:
            product = product_service.update_product(
                product_id, request.get_json(silent=True)
            )
            return product, 200
        except ProductServiceError as exc:
            return error_response(exc.message, exc.status_code)

    def delete(self, product_id: int):
        try:
            product_service.delete_product(product_id)
            return "", 204
        except ProductServiceError as exc:
            return error_response(exc.message, exc.status_code)
