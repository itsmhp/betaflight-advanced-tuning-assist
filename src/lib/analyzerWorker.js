/**
 * analyzerWorker.js
 * Web Worker entry point for running all BBL analyzers off the main thread.
 * This prevents the "Aw, Snap!" tab crash caused by 20-30s of synchronous
 * computation with 170k+ frame BBL logs.
 */
import { runAllAnalyzers, computeOverallScore, aggregateResults, renderCLI } from './analyzeAll.js';

self.onmessage = async (e) => {
  const { bbParsed, cliParsed, tuningParams } = e.data;

  try {
    const results = await runAllAnalyzers(
      bbParsed,
      cliParsed,
      tuningParams,
      (step, total, key) => {
        // Send progress updates back to main thread so progress bar stays alive
        self.postMessage({ type: 'progress', step, total, key });
      }
    );

    const score = computeOverallScore(results);
    const agg = aggregateResults(results);
    const cliText = renderCLI(agg.allCliChanges, cliParsed?.activeProfile ?? 0);

    self.postMessage({ type: 'done', results, score, agg, cliText });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message ?? String(err) });
  }
};
