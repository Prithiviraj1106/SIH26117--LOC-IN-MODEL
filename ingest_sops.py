"""
ingest_sops.py

Improved MRPL document ingestion pipeline.

Workflow:

PDF
 ↓
Extract text
 ↓
Chunk text
 ↓
Generate file hash
 ↓
Check duplicate
 ↓
Store chunks in ChromaDB
"""

import hashlib
import os
from pathlib import Path

import chromadb
from pypdf import PdfReader

from embedding import DEFAULT_EMBEDDING_FUNCTION


# ==========================================
# PROJECT PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

DB_PATH = BASE_DIR / "chroma_data"

SOP_DIR = (
    BASE_DIR
    / "MRPL_SIH_Synthetic_Dataset"
    / "mrpl_sih_dataset"
    / "SOPs"
)


# ==========================================
# CHROMADB
# ==========================================

client = chromadb.PersistentClient(
    path=str(DB_PATH)
)

collection = client.get_or_create_collection(
    name="sops",
    embedding_function=DEFAULT_EMBEDDING_FUNCTION
)


# ==========================================
# SETTINGS
# ==========================================

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150


# ==========================================
# FILE HASH
# ==========================================

def get_file_hash(file_path: Path) -> str:
    """
    Generate SHA-256 hash for duplicate detection.
    """

    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:

        while True:

            data = file.read(8192)

            if not data:
                break

            sha256.update(data)

    return sha256.hexdigest()


# ==========================================
# PDF TEXT EXTRACTION
# ==========================================

def extract_text_from_pdf(file_path: Path) -> str:
    """
    Extract selectable text from a PDF.
    """

    try:

        reader = PdfReader(str(file_path))

        pages = []

        for page_number, page in enumerate(
            reader.pages,
            start=1
        ):

            page_text = page.extract_text() or ""

            page_text = page_text.strip()

            if page_text:

                pages.append(
                    f"===== PAGE {page_number} =====\n"
                    f"{page_text}"
                )


        return "\n\n".join(pages)


    except Exception as error:

        print(
            f"[ERROR] Could not read "
            f"{file_path.name}: {error}"
        )

        return ""


# ==========================================
# TEXT CHUNKING
# ==========================================

def create_chunks(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP
) -> list[str]:
    """
    Split large document text into overlapping chunks.
    """

    if not text or not text.strip():

        return []


    chunks = []

    start = 0

    text_length = len(text)


    while start < text_length:

        end = start + chunk_size

        chunk = text[start:end].strip()


        if chunk:

            chunks.append(chunk)


        if end >= text_length:

            break


        start = end - overlap


    return chunks


# ==========================================
# CHECK DUPLICATE DOCUMENT
# ==========================================

def document_exists(file_hash: str) -> bool:
    """
    Check whether this exact file hash
    already exists in ChromaDB.
    """

    try:

        results = collection.get(
            where={
                "file_hash": file_hash
            },
            limit=1
        )


        ids = results.get("ids", [])

        return len(ids) > 0


    except Exception as error:

        print(
            f"[WARNING] Duplicate check error: {error}"
        )

        return False


# ==========================================
# REMOVE OLD VERSION OF DOCUMENT
# ==========================================

def remove_existing_document(
    source_file: str
):
    """
    Remove old chunks for the same filename.

    This allows an updated version of a PDF
    to replace the previous version.
    """

    try:

        existing = collection.get(
            where={
                "source_file": source_file
            }
        )


        ids = existing.get("ids", [])


        if ids:

            collection.delete(ids=ids)

            print(
                f"[UPDATE] Removed {len(ids)} old chunks "
                f"for {source_file}"
            )


    except Exception as error:

        print(
            f"[WARNING] Could not check old version "
            f"of {source_file}: {error}"
        )


# ==========================================
# INGEST ONE PDF
# ==========================================

def ingest_pdf(file_path: Path):

    print("\n==========================================")
    print(f"[DOCUMENT] {file_path.name}")
    print("==========================================")


    # --------------------------------------
    # GENERATE HASH
    # --------------------------------------

    print("[HASH] Generating file fingerprint...")

    file_hash = get_file_hash(file_path)

    print("[HASH] File hash generated.")


    # --------------------------------------
    # DUPLICATE CHECK
    # --------------------------------------

    print("[DUPLICATE CHECK] Checking database...")


    if document_exists(file_hash):

        print(
            "[SKIPPED] Exact duplicate already exists."
        )

        return


    # --------------------------------------
    # REMOVE OLD VERSION
    # --------------------------------------

    remove_existing_document(
        file_path.name
    )


    # --------------------------------------
    # EXTRACT TEXT
    # --------------------------------------

    print("[PDF] Extracting text...")

    text = extract_text_from_pdf(
        file_path
    )


    if not text:

        print(
            "[SKIPPED] No readable text found."
        )

        return


    # --------------------------------------
    # CREATE CHUNKS
    # --------------------------------------

    print("[CHUNKING] Creating chunks...")

    chunks = create_chunks(text)


    if not chunks:

        print(
            "[SKIPPED] No chunks created."
        )

        return


    print(
        f"[CHUNKING] Created {len(chunks)} chunks."
    )


    # --------------------------------------
    # CREATE IDS
    # --------------------------------------

    ids = []

    metadatas = []


    for index, chunk in enumerate(
        chunks,
        start=1
    ):

        chunk_id = (
            f"{file_hash[:16]}_chunk_{index}"
        )


        ids.append(chunk_id)


        metadatas.append({

            "source_file": file_path.name,

            "file_hash": file_hash,

            "document_type": "SOP",

            "chunk_number": index,

            "total_chunks": len(chunks)

        })


    # --------------------------------------
    # STORE IN CHROMADB
    # --------------------------------------

    print("[CHROMADB] Storing chunks...")


    collection.add(

        documents=chunks,

        metadatas=metadatas,

        ids=ids

    )


    print(
        f"[SUCCESS] Stored {len(chunks)} chunks "
        f"from {file_path.name}"
    )


# ==========================================
# MAIN PROGRAM
# ==========================================

def main():

    print("\n==========================================")
    print("   MRPL DOCUMENT INGESTION SYSTEM")
    print("==========================================")


    # --------------------------------------
    # CHECK SOP FOLDER
    # --------------------------------------

    if not SOP_DIR.exists():

        print(
            f"\n[ERROR] SOP folder not found:\n"
            f"{SOP_DIR}"
        )

        return


    # --------------------------------------
    # FIND PDF FILES
    # --------------------------------------

    pdf_files = sorted(
        SOP_DIR.glob("*.pdf")
    )


    if not pdf_files:

        print(
            "\n[INFO] No PDF files found."
        )

        return


    print(
        f"\nFound {len(pdf_files)} PDF document(s)."
    )


    # --------------------------------------
    # INGEST DOCUMENTS
    # --------------------------------------

    for pdf_file in pdf_files:

        ingest_pdf(pdf_file)


    # --------------------------------------
    # FINAL DATABASE STATUS
    # --------------------------------------

    print("\n==========================================")
    print("        INGESTION COMPLETED")
    print("==========================================")

    print(
        f"Total chunks in database: "
        f"{collection.count()}"
    )


# ==========================================
# RUN
# ==========================================

if __name__ == "__main__":

    main()