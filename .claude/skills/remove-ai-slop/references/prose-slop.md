# Prose slop — detailed patterns

Read this when editing writing. Each pattern gives the tell, why it costs the reader, a before/after, and the case where it is _not_ slop.

The governing question for every edit: **does the reader lose any information if this goes?** If no, cut it. If yes, keep it — however AI-flavoured it looks.

## Contents

1. [Filler openers](#1-filler-openers)
2. [Hedge stacks](#2-hedge-stacks)
3. [Restating the question](#3-restating-the-question)
4. [Reflexive both-sidesing](#4-reflexive-both-sidesing)
5. [Empty summaries](#5-empty-summaries)
6. [Structural tics](#6-structural-tics)
7. [Padded scaffolding](#7-padded-scaffolding)
8. [Inflated register](#8-inflated-register)
9. [Unearned emphasis](#9-unearned-emphasis)
10. [Vague attribution](#10-vague-attribution)
11. [Word-level tells](#word-level-tells--handle-with-care)
12. [What to leave alone](#what-to-leave-alone)

---

## 1. Filler openers

**Tell:** the sentence takes a run-up before saying anything. "It's worth noting that", "It's important to remember that", "In today's fast-paced world", "When it comes to X", "One thing to consider is".

**Cost:** the reader pays for words that carry no content, and the real claim lands late.

> **Before:** It's worth noting that the migration may take several hours to complete.
> **After:** The migration takes several hours.

**Not slop when:** the phrase does real contrastive work — "Worth noting, _because it contradicts the previous section_, that…". If it flags a genuine exception, it earns its place.

## 2. Hedge stacks

**Tell:** several hedges on one claim. "may potentially", "could possibly help to some extent", "it seems likely that this might".

**Cost:** stacked hedges do not convey more uncertainty than one — they convey unwillingness to commit, and the reader stops being able to tell which claims are actually shaky.

> **Before:** This approach may potentially offer some degree of improvement in certain cases.
> **After:** This is usually faster, though not on small inputs.

**Not slop when:** a single hedge is the honest calibration. "Roughly 40%" and "this probably explains it" are precision, not padding. Cut hedges down to one; do not cut the last one if the uncertainty is real. Turning a hedged claim into a confident one is a _worse_ error than leaving the hedge.

## 3. Restating the question

**Tell:** the opening paragraph paraphrases the prompt before starting. "You've asked about X. X is an interesting topic that involves several considerations."

**Cost:** the reader wrote the question; they know what it was.

> **Before:** You asked how to configure caching. Caching configuration is an important topic with several approaches worth considering. Let's explore them.
> **After:** Three options, in order of how much control you need:

**Not slop when:** you are restating to _disambiguate_ — "Taking this as a question about HTTP caching rather than the query cache" is useful, because it exposes an assumption the reader can correct.

## 4. Reflexive both-sidesing

**Tell:** balance applied as a reflex rather than because the evidence is balanced. "There are pros and cons to each", "it depends on your use case", a symmetric list where one side is much stronger.

**Cost:** this is an accuracy failure, not a style one. Presenting a weak option as comparable to a strong one misinforms.

> **Before:** Both approaches have merit. Option A offers simplicity, while Option B offers flexibility. The right choice depends on your needs.
> **After:** Use A. B's extra flexibility only matters if you need runtime plugin loading, and you don't. A is a tenth of the code.

**Not slop when:** the trade-off is genuine and the deciding factor is something you cannot see. Then name the factor, so the reader can decide with one question rather than a survey — "If the file can exceed memory, stream it; otherwise read it whole."

## 5. Empty summaries

**Tell:** a closing paragraph that restates the piece without adding anything; a heading whose first sentence repeats the heading.

**Cost:** it trains the reader to skip endings, which means they also skip the ones that matter.

> **Before:** ## Error handling
> Error handling is an important part of this system. In this section we'll look at how errors are handled.
> **After:** ## Error handling
> Every error surfaces as a `Result`, so nothing throws across a module boundary.

**Not slop when:** the summary genuinely synthesises — draws a conclusion the body supports but never states outright, or gives the reader the one thing to remember. Long technical documents also legitimately need recaps.

## 6. Structural tics

**Tell:** mechanical sameness. Every paragraph exactly three sentences. Every list exactly three items. Every section the same length regardless of how much there is to say. Rhetorical triples everywhere — "faster, cleaner, and more maintainable".

**Cost:** the rhythm becomes audible and the reader starts hearing the template instead of the content. Worse, three-item lists get _padded_ — the third item is often invented to complete the pattern.

**Fix:** let length follow content. Some sections are two sentences; some are two pages. If a list has two real items, ship two.

**Not slop when:** the parallelism is doing work — genuinely parallel items should be phrased in parallel. The tell is uniformity that persists regardless of the underlying content.

## 7. Padded scaffolding

**Tell:** headers, bullets, and bold imposed on content that is one continuous argument. Five headings over eight sentences. A bulleted list whose items are full sentences that read as a paragraph.

**Cost:** structure signals "these are separable parts." When they are not, it fragments an argument that depended on flowing.

> **Before:**
> **Performance:** The cache is faster.
> **Reliability:** It also fails less.
> **Cost:** And it's cheaper.
> **After:** The cache is faster, fails less, and costs less to run.

**Not slop when:** the content really is a set of independent items, or the reader will scan rather than read — reference docs, runbooks, comparison tables. Match the structure to how the piece will be used.

## 8. Inflated register

**Tell:** words doing less work than their size implies. "utilize" for use, "leverage" for use, "facilitate" for help, "in order to" for to, "a number of" for some, "at this point in time" for now.

> **Before:** In order to facilitate the utilization of this functionality, users must first initialize the configuration.
> **After:** To use it, set the config first.

**Not slop when:** the longer word is the precise term. "Leverage" in finance and "utilization" in capacity planning are technical vocabulary. Substituting the short word loses meaning.

## 9. Unearned emphasis

**Tell:** bold and italics scattered without hierarchy, so nothing stands out. Words that assert importance instead of demonstrating it — "crucial", "essential", "critical", "It is vital to note".

**Cost:** emphasis is a limited resource. Spending it everywhere means the one genuinely critical warning reads like everything else.

> **Before:** It is **absolutely critical** that you **always** remember to **carefully** validate **all** inputs.
> **After:** Validate inputs — unvalidated ones reach the query builder directly.

Notice the fix is not just removing bold: it replaces the assertion of importance with the _reason_, which is what actually makes the reader act.

**Not slop when:** one bolded clause in a long passage, marking the thing that will bite someone. That is emphasis working.

## 10. Vague attribution

**Tell:** claims sourced to nobody. "Studies show", "experts agree", "it is widely believed", "research suggests".

**Cost:** unfalsifiable. The reader cannot check it, and it is often standing in for a half-remembered fact.

**Fix:** name the source, or state the claim plainly as your own assessment, or cut it. All three beat a phantom citation.

> **Before:** Studies show that code reviews catch most bugs.
> **After:** In this repo, the last six regressions were all caught in review rather than by tests.

## Word-level tells — handle with care

Words that circulate on "AI writing" lists: _delve_, _tapestry_, _testament to_, _navigate the landscape_, _unlock_, _robust_, _seamless_, _comprehensive_, _not only… but also_, _it's not just X, it's Y_, em-dashes.

Some are genuinely overused. But **hunting them mechanically produces worse writing than leaving them**, for two reasons:

1. They are ordinary English. Human writers use every one of them well. A find-and-replace pass generates stilted prose and false positives.
2. It targets vocabulary when the actual problem is structural. A paragraph full of approved words can still say nothing.

Judge the sentence, not the word. The reliable signal is **rhythmic sameness** — an em-dash is not slop, but forty em-dashes all performing the same dramatic pause is a tic worth breaking up. Same for "not just X, it's Y": once is a rhetorical move, five times is a template.

## What to leave alone

- **Domain-required repetition.** Legal, safety, medical, accessibility and regulatory text is often repetitive because it must be. Do not tighten it without asking.
- **Deliberate voice.** If the author or project has a documented style — playful, formal, extremely terse — match it rather than flattening toward neutral.
- **Honest uncertainty.** Covered above and worth repeating: removing the last hedge from a genuinely uncertain claim is a worse error than leaving three.
- **Repetition that aids retention.** Teaching material and long reference docs repeat on purpose; readers arrive mid-document.
- **Accessibility scaffolding.** Headings, link text and summaries that look redundant to a sighted reader may be how someone navigates the document.

## Working method

1. **Read the whole thing first.** Local edits made without the shape of the argument in view tend to cut connective tissue.
2. **Cut, then reread aloud.** Slop removal can leave prose choppy; the fix is usually rejoining sentences, not restoring the filler.
3. **Preserve every factual claim.** Diff the claims in and out. Tightening must not quietly drop information — that is a worse failure than the padding was.
4. **Report what you changed and why.** "Cut the opening paragraph because it restated the brief" lets the author disagree. Silent rewriting does not.
