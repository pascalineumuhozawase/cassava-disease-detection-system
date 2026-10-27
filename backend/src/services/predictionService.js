/**
 * DEMO ONLY: this is a connectivity placeholder, not image AI.
 * Replace with a trained and validated cassava classifier inference call.
 * Never use this result for real crop treatment decisions.
 */
export async function predictCassavaDisease(_imagePath) {
  const mode = process.env.PREDICTION_MODE || 'demo';
  if (mode !== 'demo') {
    throw new Error('No production inference adapter is configured. Configure a validated model service.');
  }
  return {
    diseaseClass: 'Demo result — model not connected',
    confidence: 0,
    modelMode: 'demo',
    notes: 'This upload verifies the application workflow only. Connect a trained cassava disease model to obtain a real prediction.'
  };
}
