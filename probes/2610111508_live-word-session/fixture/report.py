TEMPLATE = 'template.dotx'
LAYOUT = {'chapter-two': {'pageBreakBefore': True}, 'fig-stable': {'widthMm': 90}, 'chapter-3': {'pageBreakBefore': True}, 'chapter-4': {'pageBreakBefore': True}, 'chapter-5': {'pageBreakBefore': True}, 'chapter-6': {'pageBreakBefore': True}, 'chapter-7': {'pageBreakBefore': True}, 'chapter-8': {'pageBreakBefore': True}}

def validate(doc, content):
    assert doc.ComputeStatistics(2) == 10, 'The fixed performance fixture must have exactly ten total pages.'
    return {'status': 'passed', 'pages': 10}
