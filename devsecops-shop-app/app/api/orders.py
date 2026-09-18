"""Orders API resources."""

from flask import request
from flask_restful import Resource

from app.api.errors import error_response
from app.services import order_service
from app.services.order_service import OrderServiceError


class OrderListResource(Resource):
    def post(self):
        try:
            order = order_service.create_order(request.get_json(silent=True))
            return order, 201
        except OrderServiceError as exc:
            return error_response(exc.message, exc.status_code)


class OrderResource(Resource):
    def get(self, order_id: int):
        try:
            return order_service.get_order(order_id), 200
        except OrderServiceError as exc:
            return error_response(exc.message, exc.status_code)
