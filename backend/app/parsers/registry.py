from app.parsers.base import BaseBankParser, ParsedStatement

_registry: dict[str, BaseBankParser] = {}


def register_parser(parser: BaseBankParser):
    _registry[parser.bank_id] = parser


def get_parser(bank_id: str) -> BaseBankParser | None:
    return _registry.get(bank_id)


def list_parsers() -> list[BaseBankParser]:
    return list(_registry.values())


def auto_detect_and_parse(pdf_bytes: bytes, password: str | None = None) -> tuple[str, ParsedStatement] | None:
    """Try each registered parser. Returns (bank_id, result) or None."""
    for bank_id, parser in _registry.items():
        try:
            result = parser.parse(pdf_bytes, password)
            if len(result.transactions) > 0:
                return bank_id, result
        except Exception:
            continue
    return None


def _auto_register():
    """Import all parser modules to trigger registration."""
    from app.parsers import hdfc, icici, sbi, axis, amex  # noqa: F401


_auto_register()
