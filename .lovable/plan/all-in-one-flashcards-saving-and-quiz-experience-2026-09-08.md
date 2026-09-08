# All-in-one, flashcards saving, and quiz experience

## 1. Real summary in All-in-one, with a PDF download

Today the All-in-one "Summary" tab shows a short AI blurb made only for that tab.

- When an All-in-one lecture is built, also run the full **Summary mode** engine (the same one used when you send a PDF or photos to Summary) on the uploaded source, so the summary is long, conceptual and structured — not a few bullet points.
- The Summary tab shows that full summary in the same paper-style reading layout Summary mode uses.
- Add a **Download PDF** button that produces a real RitaJet-styled PDF file (title, sections, key points) — a downloaded file, not the browser print dialog.
- The summary is saved with the lecture, so it is there on every later visit and can be re-downloaded.
- If summary generation fails, the tab explains why and offers a retry, instead of showing an empty panel.

## 2. Save generated flashcards into the Flashcards mode

Cards made in All-in-one (and in Lecture Lab) currently live only inside that lecture.

- Add a **Save to my flashcards** action above the card grid.
- It opens a picker: choose a subject and a sub-subject, or create a new one on the spot.
- You can save all cards or tick the ones you want.
- Saved cards appear in the normal Flashcards mode under the chosen sub-subject and behave like any hand-made card (review, edit, delete).
- Saving twice does not duplicate cards.

## 3. Rebuilt question player (used by All-in-one and Lecture Lab)

- Restyle in the RitaJet cream/green language: no black pills. Bigger answer choices with generous padding and clear tap targets, a large green primary action, calm hover/selected states.
- Remove the animation and re-render work that makes answering feel laggy; selecting an answer and moving to the next question responds immediately.
- Progress bar, question counter and flag control restyled to match.
- **Leave quiz** returns you where you started: back to the All-in-one workspace when the round was started there, back to Lecture Lab when started there.
- Result screen restyled the same way.

## 4. Remove the watermark

Remove the email/username watermark overlay from all study content — question cards, exam cards and summaries — including the background listeners and timers behind it, which also removes a source of lag.

## Technical notes

- All-in-one summary: call the existing `summaries` generation path from `aioSummary`, persist the long summary alongside `aio_summaries`, and expose it through `aioLoad`.
- PDF: client-side generation from the stored summary text (jsPDF), matching site typography/colours; no server dependency.
- Flashcard bridge: new server function inserting into `flash_subjects` / `flash_cards`, with subject+sub-subject selection and inline creation; reuse `src/lib/flashcards.ts` helpers.
- Quiz: rework `src/routes/study.lectures.run.tsx` (styling, memoised option rendering, a `from` search param for the return target); the All-in-one tab passes that param.
- Watermark: drop `ProtectedContent` usage in `courses.$courseId.run.tsx` and `WatermarkPattern` in the summary view, and remove the now-unused overlay code.

## Verification

Typecheck, then a signed-in end-to-end pass: build an All-in-one lecture, read and download the summary PDF, save its cards into a new sub-subject and confirm they show in Flashcards mode, run a question round from both All-in-one and Lecture Lab and confirm the leave button returns to the right place, with no watermark and no console errors.
