"""Almacenamiento SQLite de la colección y de los fragmentos vectorizados del RAG."""

import csv
import json
import math
import sqlite3
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path

from preparar_datos import DATA, preparar_datos

TABLAS = {
    "prendas": ("prenda_id", "Catálogo"),
    "ventas": ("venta_id", "Operaciones"),
    "vendedores": ("vendedor_id", "Alias públicos ficticios"),
}

ESQUEMA = """
CREATE TABLE IF NOT EXISTS metadatos (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vendedores (
    vendedor_id TEXT PRIMARY KEY,
    alias TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prendas (
    prenda_id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    marca TEXT NOT NULL,
    talla TEXT NOT NULL,
    color TEXT NOT NULL,
    conservacion TEXT NOT NULL,
    precio_publicado_eur TEXT NOT NULL,
    disponibilidad TEXT NOT NULL,
    vendedor_id TEXT NOT NULL REFERENCES vendedores(vendedor_id),
    fecha_alta TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ventas (
    venta_id TEXT PRIMARY KEY,
    prenda_id TEXT NOT NULL REFERENCES prendas(prenda_id),
    fecha_venta TEXT NOT NULL,
    estado TEXT NOT NULL,
    precio_acordado_eur TEXT NOT NULL,
    envio_eur TEXT NOT NULL,
    total_eur TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prendas_por_vendedor ON prendas(vendedor_id);
CREATE INDEX IF NOT EXISTS ventas_por_prenda ON ventas(prenda_id);
CREATE TABLE IF NOT EXISTS rag_fragmentos (
    fragmento_id TEXT NOT NULL,
    modelo TEXT NOT NULL,
    huella TEXT NOT NULL,
    texto TEXT NOT NULL,
    fuentes_json TEXT NOT NULL,
    vector_json TEXT NOT NULL,
    PRIMARY KEY (fragmento_id, modelo)
);
"""


def vector_valido(vector):
    return (isinstance(vector, list) and bool(vector)
            and all(isinstance(x, (int, float)) and not isinstance(x, bool)
                    and math.isfinite(x) for x in vector)
            and any(x != 0 for x in vector))


def cosine(a, b):
    if len(a) != len(b):
        return -1.0
    denominator = math.sqrt(sum(x*x for x in a) * sum(x*x for x in b))
    return sum(x*y for x, y in zip(a, b)) / denominator if denominator else 0.0


class BaseDatos:
    def __init__(self, path=DATA / "loop.sqlite3", seed_dir=DATA):
        self.path = Path(path)
        self.seed_dir = Path(seed_dir)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.inicializar()

    @contextmanager
    def conectar(self):
        # Cada operación abre su conexión: no se comparten conexiones entre hilos.
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def inicializar(self):
        with self.conectar() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(ESQUEMA)
            connection.execute("BEGIN IMMEDIATE")
            if connection.execute("SELECT 1 FROM metadatos WHERE clave = 'datos_inicializados'").fetchone():
                return
            if self.seed_dir == DATA:
                preparar_datos()
            # La importación y su marca se confirman juntas, una única vez.
            for table in ("vendedores", "prendas", "ventas"):
                with (self.seed_dir / f"{table}.csv").open(encoding="utf-8-sig", newline="") as file:
                    rows = list(csv.DictReader(file))
                fields = [row["name"] for row in connection.execute(f"PRAGMA table_info({table})")]
                columns = ", ".join(fields)
                placeholders = ", ".join("?" for _ in fields)
                connection.executemany(f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
                                       [tuple(row[field] for field in fields) for row in rows])
            connection.execute("INSERT INTO metadatos VALUES ('datos_inicializados', '1')")
            connection.execute("INSERT INTO metadatos VALUES ('version_esquema', '1')")

    def leer_coleccion(self):
        with self.conectar() as connection:
            connection.execute("BEGIN")
            tables, columns = {}, {}
            for name, (id_field, _) in TABLAS.items():
                cursor = connection.execute(f"SELECT * FROM {name} ORDER BY {id_field}")
                columns[name] = [column[0] for column in cursor.description]
                rows = [dict(row) for row in cursor]
                for row in rows:
                    for key in row:
                        if key.endswith("_eur"):
                            row[key] = float(Decimal(row[key]))
                tables[name] = rows
            return tables, columns

    def leer_indice(self, model):
        with self.conectar() as connection:
            rows = connection.execute("SELECT * FROM rag_fragmentos WHERE modelo = ?", (model,))
            result = {}
            for row in rows:
                try:
                    vector = json.loads(row["vector_json"])
                except (ValueError, TypeError):
                    continue
                if vector_valido(vector):
                    result[row["fragmento_id"]] = {"huella": row["huella"], "vector": vector}
            return result

    def guardar_indice(self, chunks, vectors, hashes, model):
        with self.conectar() as connection:
            connection.executemany("""
                INSERT INTO rag_fragmentos VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (fragmento_id, modelo) DO UPDATE SET
                    huella = excluded.huella, texto = excluded.texto,
                    fuentes_json = excluded.fuentes_json, vector_json = excluded.vector_json
                WHERE huella != excluded.huella OR vector_json != excluded.vector_json
                   OR texto != excluded.texto OR fuentes_json != excluded.fuentes_json
            """, [(chunk["id"], model, fingerprint, chunk["texto"],
                   json.dumps(chunk["fuentes"], ensure_ascii=False), json.dumps(vector))
                  for chunk, vector, fingerprint in zip(chunks, vectors, hashes)])
            # Eliminar también las referencias a registros que ya no existen.
            placeholders = ", ".join("?" for _ in chunks)
            if chunks:
                connection.execute(f"DELETE FROM rag_fragmentos WHERE fragmento_id NOT IN ({placeholders})",
                                   [chunk["id"] for chunk in chunks])
            else:
                connection.execute("DELETE FROM rag_fragmentos")

    def buscar(self, query_vector, model, threshold, limit=6):
        with self.conectar() as connection:
            def similarity(serialized):
                vector = json.loads(serialized)
                return cosine(query_vector, vector)

            connection.create_function("similitud_coseno", 1, similarity, deterministic=True)
            rows = connection.execute("""
                SELECT fragmento_id, texto, fuentes_json,
                       similitud_coseno(vector_json) AS similitud
                FROM rag_fragmentos
                WHERE modelo = ? AND similitud_coseno(vector_json) >= ?
                ORDER BY similitud DESC, fragmento_id
                LIMIT ?
            """, (model, threshold, limit))
            return [{"id": row["fragmento_id"], "texto": row["texto"],
                     "fuentes": json.loads(row["fuentes_json"])} for row in rows]


if __name__ == "__main__":
    database = BaseDatos()
    tables, _ = database.leer_coleccion()
    print("Base de datos:", database.path)
    for name, rows in tables.items():
        print(f"{name}: {len(rows)} registros")
