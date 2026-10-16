"""Extrae los registros ficticios de la maqueta, sin ejecutar su JavaScript."""

import ast
import csv
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent
DATA = BASE / "datos"
TABLES = {"prendas": "garments", "ventas": "sales", "vendedores": "sellers"}


def preparar_datos():
    DATA.mkdir(exist_ok=True)
    missing = [name for name in TABLES if not (DATA / f"{name}.csv").exists()]
    if not missing:
        return
    html = (BASE / "maquetas.html").read_text(encoding="utf-8-sig")
    for name in missing:
        match = re.search(r"const\s+" + TABLES[name] + r"\s*=\s*(\[.*?\]);", html, re.S)
        if not match:
            raise ValueError(f"No se encuentra {TABLES[name]} en maquetas.html")
        literal = re.sub(r"([,{]\s*)(\w+)\s*:", r"\1'\2':", match[1])
        rows = ast.literal_eval(literal)
        with (DATA / f"{name}.csv").open("w", encoding="utf-8", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


if __name__ == "__main__":
    preparar_datos()
    print("Datos preparados en", DATA)
