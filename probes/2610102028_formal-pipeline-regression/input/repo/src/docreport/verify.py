"""Generic checks; each report supplies its own content and layout assertions."""
from hashlib import sha256
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from pypdf import PdfReader


def sha(path):
    return sha256(path.read_bytes()).hexdigest()


def document_state(doc, expected_equations):
    text = doc.Content.Text
    if re.search(r"@(MATH|FIELD|NUMSTART|NUMEND)\d+@", text):
        raise RuntimeError("Unresolved generation placeholders remain in the document.")
    count = sum(shape.Type == 1 and shape.OLEFormat.ProgID == "Equation.DSMT4"
                for shape in doc.InlineShapes)
    if doc.OMaths.Count != 0 or count != expected_equations:
        raise RuntimeError(f"Expected {expected_equations} MathType objects and no OMML; found {count}/{doc.OMaths.Count}.")
    return dict(pages=doc.ComputeStatistics(2), mathTypeObjects=count, ommlCount=doc.OMaths.Count,
                tables=doc.Tables.Count, figures=sum(shape.Type == 3 for shape in doc.InlineShapes),
                footnotes=doc.Footnotes.Count, toc=doc.TablesOfContents.Count,
                contentControls=doc.ContentControls.Count)


def package_state(path, expected_equations):
    with ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        objects = [o for o in root.findall(".//{urn:schemas-microsoft-com:office:office}OLEObject")
                   if o.get("ProgID") == "Equation.DSMT4"]
        omml = root.findall(".//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath")
        if len(objects) != expected_equations or omml:
            raise RuntimeError("Saved DOCX equation structures differ from the report.")
        if any(o.get("Type") != "Embed" for o in objects):
            raise RuntimeError("MathType equations must be embedded, not linked.")
        relationships = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in relationships}
        for obj in objects:
            key = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            target = targets.get(obj.get(key), "")
            if not target.startswith("embeddings/") or "word/" + target not in archive.namelist():
                raise RuntimeError("Embedded MathType payload is missing from the DOCX.")
    return dict(mathTypeObjects=len(objects), ommlCount=len(omml), sha256=sha(path))


def pdf_state(path, expected_pages):
    pages = PdfReader(path).pages
    if len(pages) != expected_pages:
        raise RuntimeError(f"Word reports {expected_pages} pages but PDF has {len(pages)}.")
    texts = [page.extract_text() or "" for page in pages]
    return dict(pages=len(pages), sha256=sha(path)), texts
