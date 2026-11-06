#!/usr/bin/env python3
"""Real-browser state-retention checks for HamExamTrainer.

Run against a production preview, never a personal browser profile:
  npm ci && npm run build
  npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
  python -m pip install playwright
  python -m playwright install chromium
  python scripts/test-persistence-e2e.py --banks ca-basic

Default: all five banks. No application source changes, seeded answers,
storage-state imports, or API calls that fabricate progress. Every answer
is entered by clicking the real UI. IndexedDB is inspected read-only.
"""
import argparse
import json
import re
import shutil
import tempfile
import time
import unicodedata
from collections import OrderedDict
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = """async () => {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('hamexam-trainer');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  const names = ['records', 'sessions', 'attempts', 'settings'];
  const tx = db.transaction(names, 'readonly');
  const result = {};
  await Promise.all(names.map(name => new Promise((resolve, reject) => {
    const r = tx.objectStore(name).getAll();
    r.onsuccess = () => { result[name] = r.result; resolve(); };
    r.onerror = () => reject(r.error);
  })));
  db.close(); return result;
}"""


def snapshot(page):
    return page.evaluate(SNAPSHOT)


def wait_for(check, message, timeout=10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(.02)
    raise AssertionError(message)


def choices(page):
    return page.locator('question-card button.choice')


def record_count(page):
    return len(snapshot(page)['records'])


class Run:
    def __init__(self, playwright, args, profile):
        self.playwright, self.args, self.profile = playwright, args, profile
        self.errors = []
        self.context = None
        self.start()

    def start(self, offline=False):
        exe = self.args.chromium or shutil.which('chromium')
        self.context = self.playwright.chromium.launch_persistent_context(
            str(self.profile), headless=True,
            **({'executable_path': exe} if exe else {}),
            viewport={'width': 1280, 'height': 900},
        )
        self.context.set_offline(offline)
        self.page = self.context.pages[0] if self.context.pages else self.context.new_page()
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.goto(self.args.url)
        expect(self.page.locator('chapter-list .section-row').first).to_be_visible()

    def restart(self, offline=False):
        self.context.close()
        self.start(offline=offline)

    def select_bank(self, bank):
        self.page.locator('select.bank-chooser').select_option(bank)
        wait_for(lambda: any(s['key'] == 'bank' and s['value'] == bank
                            for s in snapshot(self.page)['settings']), 'bank selection did not persist')
        expect(self.page.locator('select.bank-chooser')).to_have_value(bank)

    def practice(self):
        self.page.get_by_role('tab', name='Practice', exact=True).click()
        expect(self.page.locator('chapter-list .section-row').first).to_be_visible()

    def coverage(self, n, total):
        expect(self.page.locator('.ready-label')).to_contain_text(f'{n} of {total} questions studied')

    def close(self):
        if self.context:
            self.context.close()


def bank_data(bank):
    return json.loads((ROOT / 'src/data/banks' / f'{bank}.json').read_text())


def semantic_key(q):
    def normalize(s):
        s = unicodedata.normalize('NFC', s).lower()
        s = s.translate(str.maketrans({'‘': "'", '’': "'", '“': '"', '”': '"'}))
        return re.sub(r'[.!?,;:]+$', '', re.sub(r'\s+', ' ', s).strip())
    return (q['bank'], q['section'], normalize(q['question']),
            tuple(sorted(normalize(c) for c in q['choices'])))


def practice_bank(pw, args, bank, results):
    qs = bank_data(bank)
    sections = OrderedDict()
    for q in qs:
        sections.setdefault(q['section'], []).append(q)
    with tempfile.TemporaryDirectory(prefix=f'ham-e2e-{bank}-') as temp:
        run = Run(pw, args, Path(temp))
        try:
            run.select_bank(bank)
            run.coverage(0, len(qs))
            count = 0
            distinct = set()
            for number, (section, questions) in enumerate(sections.items()):
                row = run.page.locator('chapter-list .section-row').filter(
                    has=run.page.locator('.section-id', has_text=re.compile('^' + re.escape(section) + '$')))
                row.click()
                for q in questions:
                    expect(run.page.locator('question-card .question-text')).to_have_text(q['question'])
                    # Deliberately miss every tenth answer. Completion means
                    # studied coverage, not a claim of 100% correctness.
                    choice = (q['correctIndex'] + 1) % 4 if count % 10 == 0 else q['correctIndex']
                    choices(run.page).nth(choice).click()
                    run.page.locator('question-card button.next').click()
                    count += 1
                    distinct.add(semantic_key(q))
                expect(run.page.locator('.done-note')).to_contain_text(f'Section {section} complete')
                wait_for(lambda: sum(r['attempts'] for r in snapshot(run.page)['records']) == count,
                         f'not all {count} answer attempts saved')
                run.practice()
                run.coverage(count, len(qs))
                # Interrupt at completed section boundaries, then actually
                # close and reopen Chromium, preserving its temporary profile.
                if number in {0, len(sections) // 2}:
                    before = snapshot(run.page)
                    run.restart()
                    expect(run.page.locator('select.bank-chooser')).to_have_value(bank)
                    run.coverage(count, len(qs))
                    assert snapshot(run.page) == before, 'browser restart altered progress'
                if number % 10 == 0:
                    print(f'{bank}: {count}/{len(qs)} answered through UI', flush=True)
            before = snapshot(run.page)
            assert len(before['records']) == len(distinct)
            assert sum(r['attempts'] for r in before['records']) == len(qs)
            assert sum(r['wrongCount'] for r in before['records']) == (len(qs) + 9) // 10
            assert all(r['intervalDays'] >= 0 and r['dueAt'] > 0 for r in before['records'])
            expect(run.page.locator('.ready-num')).to_have_text('100%')
            complete_sections = run.page.locator('chapter-list .state.done').count()
            other = 'ca-basic' if bank != 'ca-basic' else 'us-tech'
            run.select_bank(other)
            run.coverage(0, len(bank_data(other)))
            run.select_bank(bank)
            run.coverage(len(qs), len(qs))
            assert snapshot(run.page)['records'] == before['records'], 'bank switch changed stored records'
            # Verify both a same-tab reload and real browser restart.
            run.page.reload()
            run.coverage(len(qs), len(qs))
            assert snapshot(run.page)['records'] == before['records']
            run.restart()
            run.coverage(len(qs), len(qs))
            assert snapshot(run.page)['records'] == before['records']
            # Exercise the installed service worker and a cold offline page.
            run.page.evaluate('async () => { await navigator.serviceWorker.ready; }')
            run.restart(offline=True)
            run.coverage(len(qs), len(qs))
            assert snapshot(run.page)['records'] == before['records']
            assert not run.errors, run.errors
            results.append({'case': 'complete-bank-persistence', 'bank': bank,
                            'questions': len(qs), 'sections': len(sections),
                            'unique_records': len(distinct), 'completed_sections': complete_sections,
                            'attempts': sum(r['attempts'] for r in before['records']),
                            'status': 'PASS' if sum(r['attempts'] for r in before['records']) == len(qs) and complete_sections == len(sections) else 'FAIL',
                            'checks': ['all answers clicked', 'mixed correct and wrong counts',
                                       'midway browser restarts', '100% coverage', 'bank isolation',
                                       'reload', 'browser restart', 'cold offline restart']})
        finally:
            run.close()


def current_exam_question(page, qs):
    text = page.locator('question-card .question-text').inner_text()
    section = page.locator('question-card .section-tag').inner_text()
    labels = page.locator('question-card button.choice > span:nth-child(2)').all_text_contents()
    return next(q for q in qs if q['question'] == text and q['section'] == section and q['choices'] == labels)


def mock_exam(pw, args, bank, results):
    qs = bank_data(bank)
    with tempfile.TemporaryDirectory(prefix=f'ham-exam-{bank}-') as temp:
        run = Run(pw, args, Path(temp))
        try:
            run.select_bank(bank)
            run.page.get_by_role('tab', name='Exam', exact=True).click()
            run.page.get_by_role('button', name='Start the exam', exact=True).click()
            wait_for(lambda: len(snapshot(run.page)['sessions']) == 1, 'new exam not saved')
            total = len(snapshot(run.page)['sessions'][0]['answers'])
            for i in range(total):
                q = current_exam_question(run.page, qs)
                # One wrong answer gives a nontrivial expected verdict.
                choice = (q['correctIndex'] + 1) % 4 if i == 0 else q['correctIndex']
                choices(run.page).nth(choice).click()
                wait_for(lambda: sum(a is not None for a in snapshot(run.page)['sessions'][0]['answers']) == i + 1,
                         f'exam answer {i + 1} not saved')
                if i == total // 2:
                    before = snapshot(run.page)
                    run.restart()
                    expect(run.page.locator('select.bank-chooser')).to_have_value(bank)
                    run.page.get_by_role('tab', name='Exam', exact=True).click()
                    expect(run.page.locator('question-card .question-text')).to_be_visible()
                    assert snapshot(run.page) == before, 'resuming changed session order, answers, position or timestamps'
                    expect(run.page.locator('exam-session .bar').first).to_contain_text(f'Question {i + 2} / {total}')
            run.page.get_by_role('button', name='Submit exam', exact=True).click()
            expected_percent = (total - 1) * 100 // total
            expect(run.page.locator('exam-session .verdict')).to_contain_text(f'{expected_percent}%')
            after = snapshot(run.page)
            assert after['sessions'] == [], 'submitted exam still resumable'
            assert len(after['attempts']) == 1
            attempt = after['attempts'][0]
            assert attempt['correct'] == total - 1 and attempt['total'] == total and attempt['passed']
            run.restart()
            run.page.get_by_role('tab', name='Exam', exact=True).click()
            expect(run.page.locator('exam-session .history')).to_contain_text(f'{expected_percent}% PASS')
            assert snapshot(run.page)['attempts'] == after['attempts'], 'attempt history changed after reopening'
            assert not run.errors, run.errors
            results.append({'case': 'mock-exam-resume-and-history', 'bank': bank,
                            'questions': total, 'status': 'PASS', 'percent': expected_percent})
        finally:
            run.close()


def interruption_probes(pw, args, results):
    bank = 'us-tech'
    qs = bank_data(bank)
    with tempfile.TemporaryDirectory(prefix='ham-interruption-') as temp:
        run = Run(pw, args, Path(temp))
        try:
            run.select_bank(bank)
            run.page.locator('chapter-list .section-row').first.click()
            for q in qs[:3]:
                expect(run.page.locator('question-card .question-text')).to_have_text(q['question'])
                choices(run.page).nth(q['correctIndex']).click()
                run.page.locator('question-card button.next').click()
            wait_for(lambda: record_count(run.page) == 3, 'practice records not saved')
            before = snapshot(run.page)
            question_before = run.page.locator('question-card .question-text').inner_text()
            run.restart()
            assert snapshot(run.page) == before
            run.page.locator('chapter-list .section-row').first.click()
            question_after = run.page.locator('question-card .question-text').inner_text()
            results.append({'case': 'practice-exact-position', 'status': 'UNSUPPORTED' if question_after != question_before else 'PASS',
                            'saved_records': 3, 'expected_question': question_before,
                            'actual_question': question_after,
                            'note': 'Answer history survives; chapter practice restarts from question 1.'})
            run.page.get_by_role('tab', name='Exam', exact=True).click()
            run.page.get_by_role('button', name='Start the exam', exact=True).click()
            first = current_exam_question(run.page, qs)
            choices(run.page).nth(first['correctIndex']).click()
            wait_for(lambda: len(snapshot(run.page)['sessions']) == 1 and snapshot(run.page)['sessions'][0]['answers'][0] is not None,
                     'exam answer not saved')
            run.page.get_by_role('button', name='← Previous', exact=True).click()
            wait_for(lambda: snapshot(run.page)['sessions'][0]['position'] == 0, 'previous position not saved')
            before = snapshot(run.page)
            run.restart()
            run.page.get_by_role('tab', name='Exam', exact=True).click()
            expect(run.page.locator('question-card .question-text')).to_have_text(first['question'])
            assert snapshot(run.page) == before
            picked = run.page.locator('question-card button.choice.picked').count()
            if picked != 1:
                run.page.screenshot(path=str(args.output.with_suffix('.saved-answer.png')), full_page=True)
            results.append({'case': 'resumed-answered-question-visual-state',
                            'status': 'PASS' if picked == 1 else 'FAIL',
                            'stored_answer': before['sessions'][0]['answers'][0], 'visible_picked_choices': picked,
                            'note': 'Saved answer should be shown when revisiting an answered question.'})
            # The control accepts a new click, but the session silently rejects
            # overwrite. Check displayed choice versus authoritative stored answer.
            original = before['sessions'][0]['answers'][0]
            alternate = (original + 1) % 4
            if choices(run.page).nth(alternate).is_enabled():
                choices(run.page).nth(alternate).click()
                expect(run.page.locator('question-card button.choice.picked')).to_have_count(1)
                after = snapshot(run.page)['sessions'][0]
                results.append({'case': 'revisited-answer-consistency',
                                'status': 'PASS' if after['answers'][0] == alternate else 'FAIL',
                                'displayed_choice': alternate, 'stored_choice': after['answers'][0],
                                'note': 'A newly displayed selection must match the stored answer, or editing must be disabled.'})
            else:
                after = snapshot(run.page)['sessions'][0]
                results.append({'case': 'revisited-answer-consistency',
                                'status': 'PASS' if after['answers'][0] == original else 'FAIL',
                                'displayed_choice': original, 'stored_choice': after['answers'][0],
                                'note': 'The restored answer is visible and editing is disabled.'})
            run.select_bank('ca-basic')
            card_count = run.page.locator('question-card').count()
            intro_count = run.page.locator('exam-session .intro').count()
            results.append({'case': 'bank-switch-during-running-exam',
                            'status': 'PASS' if intro_count == 1 else 'FAIL',
                            'visible_question_cards': card_count,
                            'visible_intro': intro_count,
                            'text': run.page.locator('exam-session .bar').all_text_contents(),
                            'note': 'Changing banks during an active exam should show the new bank intro or its own saved session.'})
        finally:
            run.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:4173/trainer/')
    parser.add_argument('--banks', nargs='+', default=['us-tech', 'us-general', 'us-extra', 'ca-basic', 'ca-advanced'])
    parser.add_argument('--chromium', help='Optional Chromium executable; otherwise system chromium or Playwright Chromium')
    parser.add_argument('--output', type=Path, default=ROOT / 'persistence-results.json')
    parser.add_argument('--probes-only', action='store_true')
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    results = []
    started = time.monotonic()
    try:
        with sync_playwright() as pw:
            interruption_probes(pw, args, results)
            args.output.write_text(json.dumps(results, indent=2) + '\n')
            if not args.probes_only:
                for bank in args.banks:
                    practice_bank(pw, args, bank, results)
                    mock_exam(pw, args, bank, results)
                    args.output.write_text(json.dumps(results, indent=2) + '\n')
    except Exception as exc:
        results.append({'case': 'runner', 'status': 'ERROR', 'error': str(exc)})
        raise
    finally:
        args.output.write_text(json.dumps(results, indent=2) + '\n')
        print(json.dumps(results, indent=2), flush=True)
        print(f'Elapsed: {time.monotonic() - started:.1f}s', flush=True)
    # A diagnostic run still exits nonzero on verified product failures.
    raise SystemExit(1 if any(r['status'] in {'FAIL', 'ERROR'} for r in results) else 0)


if __name__ == '__main__':
    main()
