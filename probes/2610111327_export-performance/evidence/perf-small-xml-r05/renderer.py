"""Word InsertXML table transport candidate; all rendering remains in Word."""
from xml.etree import ElementTree as ET
from copy import deepcopy
import re
from docreport.compose import ContentComposer, mm
from frozen_content import bookmark

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
ET.register_namespace('w', W)


def child(parent, tag, **attrs):
    return ET.SubElement(parent, '{' + W + '}' + tag,
                         {'{' + W + '}' + key: str(value) for key, value in attrs.items()})


class XmlComposer(ContentComposer):
    def style_id(self, name):
        if not hasattr(self, '_xml_styles') or name not in self._xml_styles:
            self._xml_package_text = self.doc.WordOpenXML
            root = ET.fromstring(self._xml_package_text)
            self._xml_package = root
            self._xml_styles = {}
            for style in root.findall('.//{' + W + '}styles/{' + W + '}style'):
                title = style.find('{' + W + '}name')
                ident = style.get('{' + W + '}styleId')
                if title is not None:
                    self._xml_styles[title.get('{' + W + '}val')] = ident
            self._xml_bookmark = getattr(self, '_xml_bookmark', 100000)
        return self._xml_styles[name]

    def paragraph_xml(self, block, style):
        p = ET.Element('{' + W + '}p')
        child(child(p, 'pPr'), 'pStyle', val=self.style_id(style))
        ident = self._xml_bookmark
        self._xml_bookmark += 1
        child(p, 'bookmarkStart', id=ident, name=bookmark(block['id'], '_b'))
        text, spans = self.inline(block['content'])
        encoded = text.encode('utf-16-le')
        for start, length, marks in spans:
            run = child(p, 'r')
            if marks:
                props = child(run, 'rPr')
                for mark in marks:
                    if mark in ('strong', 'em'):
                        child(props, 'b' if mark == 'strong' else 'i')
                    elif mark in ('sub', 'sup'):
                        child(props, 'vertAlign', val='subscript' if mark == 'sub' else 'superscript')
                    elif mark == 'code':
                        child(props, 'rFonts', ascii='Consolas', hAnsi='Consolas', eastAsia='Consolas', cs='Consolas')
            node = child(run, 't')
            node.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            node.text = encoded[2 * start:2 * (start + length)].decode('utf-16-le')
        child(p, 'bookmarkEnd', id=ident)
        return p

    def table_node(self, node, depth):
        cells = [cell for row in node['rows'] for cell in row['cells']]
        if (self.container is not None or any(
                cell.get('rowSpan', 1) != 1 or cell.get('colSpan', 1) != 1
                or len(cell['blocks']) != 1 or cell['blocks'][0]['type'] != 'paragraph'
                or any(item['type'] == 'break' or any(ch in item.get('text', '') for ch in '\t\r\n\v')
                       for item in cell['blocks'][0]['content']) for cell in cells)):
            return super().table_node(node, depth)
        count = len(node['columns'])
        layout = self.layout.get(node['id'], {})
        widths = layout.get('widthsMm')
        if widths is not None:
            if len(widths) != count or any(x <= 0 for x in widths) or mm(sum(widths)) > self.width + 1:
                raise ValueError(f"{node['id']}: column widths exceed available space")
            widths = [mm(x) for x in widths]
        else:
            widths = [self.width / count] * count
        if node.get('caption'):
            self.numbered_caption(node, 'Table')
        root = ET.Element('{' + W + '}document')
        body = child(root, 'body')
        tbl = child(body, 'tbl')
        props = child(tbl, 'tblPr')
        child(props, 'tblW', w=0, type='auto')
        borders = child(props, 'tblBorders')
        for name in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
            child(borders, name, val='single', sz=4, space=0, color='auto')
        child(props, 'tblLayout', type='fixed')
        margins = child(props, 'tblCellMar')
        for name, value in [('top', 60), ('left', 80), ('bottom', 60), ('right', 80)]:
            child(margins, name, w=value, type='dxa')
        child(props, 'tblLook', val='0000', firstRow=0, lastRow=0, firstColumn=0,
              lastColumn=0, noHBand=0, noVBand=0)
        grid = child(tbl, 'tblGrid')
        for width in widths:
            child(grid, 'gridCol', w=round(width * 20))
        for ri, row in enumerate(node['rows']):
            tr = child(tbl, 'tr')
            row_props = child(tr, 'trPr')
            child(row_props, 'cantSplit')
            if ri < node['headerRows']:
                child(row_props, 'tblHeader')
            if layout.get('minRowHeightPt'):
                child(row_props, 'trHeight', val=round(layout['minRowHeightPt'] * 20), hRule='atLeast')
            for ci, cell in enumerate(row['cells']):
                tc = child(tr, 'tc')
                tc_props = child(tc, 'tcPr')
                child(tc_props, 'tcW', w=round(widths[ci] * 20), type='dxa')
                if ri < node['headerRows']:
                    child(tc_props, 'shd', val='clear', color='auto', fill='EFEFEF')
                tc.append(self.paragraph_xml(cell['blocks'][0],
                                            'Table Header' if ri < node['headerRows'] else 'Table Text'))
        target = self.point()
        start = target.Start
        # Preserve prefix declarations used inside QName-valued attributes
        # such as mc:Ignorable; ElementTree roundtrips discard those prefixes.
        payload, changed = re.subn(r'<w:body(?:\s[^>]*)?>.*?</w:body>',
                                  lambda match: ET.tostring(body, encoding='unicode'),
                                  self._xml_package_text, count=1, flags=re.S)
        assert changed == 1
        target.InsertXML(payload)
        table = self.doc.Range(start, self.point().Start).Tables.Item(1)
        self.mark(node['id'], table.Range, '_b')
        return table
