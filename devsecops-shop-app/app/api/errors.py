"""JSON error helpers."""

from flask import jsonify


def error_response(message: str, status_code: int):
    return {"error": message}, status_code


def json_error(message: str, status_code: int):
    response = jsonify({"error": message})
    response.status_code = status_code
    return response
