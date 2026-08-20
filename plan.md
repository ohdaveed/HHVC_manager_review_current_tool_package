1. **Optimize `safeMarkdown` in `js/core/utils.js`**
   - Cache the `marked` instance to avoid creating a new one on every call, which provides a significant performance boost.
   - Specifically, instantiate `marked.Marked()` (or `window.marked`) and configure its custom renderer once, then reuse it.
2. **Pre-commit Checks**
   - Run the pre-commit instructions to ensure everything is solid.
3. **Submit**
   - Push branch and create a PR with performance context.
