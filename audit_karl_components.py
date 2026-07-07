#!/usr/bin/env python3
"""Audit pages/*.js against Karl component rules from the HHVC component xlsx."""

import os
import re

PAGES_DIR = os.path.join(os.path.dirname(__file__), 'pages')

RULES = [
    {
        'name': 'description_length',
        'pattern': r"summary:\s*\n?\s*'([^']{111,})'",
        'message': 'Summary (Description) exceeds 110 characters',
    },
    {
        'name': 'meta_description_length',
        'pattern': r"metaDescription:\s*\n?\s*'([^']{111,})'",
        'message': 'metaDescription exceeds 110 characters',
    },
    {
        'name': 'title_length',
        'pattern': r"title: '([^']{66,})'",
        'message': 'Title exceeds 65 characters',
    },
    {
        'name': 'button_on_information',
        'pattern': r"type: 'Information'[\s\S]*?(?:primaryCta:|button: ')",
        'message': 'Information page has a Button/primaryCta — Buttons are Transaction-only',
    },
    {
        'name': 'button_label_length',
        'pattern': r"button: '([^']{26,})'",
        'message': 'Button label exceeds 25 characters',
    },
    {
        'name': 'table_width',
        'pattern': r"table:\s*\[[\s\S]*?\]",
        'message': 'Table may exceed 3 columns — inspect manually',
        'custom': True,
    },
]


def audit_table_width(content, filepath):
    issues = []
    for match in re.finditer(r"table:\s*(\[[\s\S]*?\])", content):
        block = match.group(1)
        rows = re.findall(r'\[[^\]]*\]', block)
        for row in rows:
            cols = row.count(',') + 1
            if cols > 3:
                line_no = content[: match.start()].count('\n') + 1
                issues.append(
                    f"  Line {line_no}: Table row has {cols} columns (max 3)\n    Snippet: {row[:120]}..."
                )
    return issues


def audit_files():
    issues_found = 0
    print('=' * 60)
    print('KARL COMPONENT AUDIT REPORT')
    print('=' * 60)

    if not os.path.isdir(PAGES_DIR):
        print(f'Error: {PAGES_DIR} not found.')
        return 1

    for filename in sorted(os.listdir(PAGES_DIR)):
        if not filename.endswith('.js'):
            continue
        filepath = os.path.join(PAGES_DIR, filename)
        with open(filepath, encoding='utf-8') as f:
            content = f.read()

        file_issues = []
        for rule in RULES:
            if rule.get('custom'):
                file_issues.extend(audit_table_width(content, filepath))
                continue
            for match in re.finditer(rule['pattern'], content):
                line_no = content[: match.start()].count('\n') + 1
                snippet = match.group(0).replace('\n', ' ')[:120]
                file_issues.append(
                    f"  Line {line_no}: {rule['message']}\n    Snippet: \"{snippet}...\""
                )

        if file_issues:
            print(f'\n[FILE] {filename}')
            for issue in file_issues:
                print(issue)
                issues_found += 1

    print('=' * 60)
    print(f'Audit complete. Found {issues_found} potential Karl component violations.')
    print('=' * 60)
    return issues_found


if __name__ == '__main__':
    raise SystemExit(1 if audit_files() else 0)
