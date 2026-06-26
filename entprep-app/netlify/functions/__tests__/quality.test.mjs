import { describe, it, expect } from 'vitest';
import { checkExplanationMismatch, checkGenerated } from '../utils/quality.mjs';

// A correct humanities option whose long phrase is PARAPHRASED in the
// explanation (same key terms, different sentence structure) rather than quoted
// verbatim. The old verbatim-substring check could not find it → false 422.
const HUM_Q = 'Какие изменения в государственном устройстве произошли в результате реформ Тауке хана?';
const HUM_OPTIONS = [
  'Развитие торговых связей с соседними государствами',
  'Усиление центральной власти и ослабление родовой знати', // correct (index 1)
  'Переход к оседлому земледелию и отказ от кочевья',
  'Введение новой письменности на основе арабской графики',
];
const HUM_CORRECT = 1;
// Reuses the option's key words, but as a different (paraphrased) sentence, so
// the full option string is NOT a contiguous substring of the explanation.
const HUM_EXPLANATION =
  'Реформы укрепили центральную власть хана: усиление управления сопровождалось ' +
  'ослаблением родовой знати, терявшей былое влияние.';

describe('checkExplanationMismatch — fuzzy mention (humanities paraphrase)', () => {
  it('does NOT false-reject a paraphrased-correct option', () => {
    // sanity: the verbatim path genuinely fails — only fuzzy matching can save it
    expect(HUM_EXPLANATION.toLowerCase()).not.toContain(HUM_OPTIONS[HUM_CORRECT].toLowerCase());
    expect(checkExplanationMismatch(HUM_Q, HUM_OPTIONS, HUM_CORRECT, HUM_EXPLANATION)).toBeNull();
  });

  it('checkGenerated reports no issues for the paraphrased-correct question', () => {
    const issues = checkGenerated(HUM_Q, HUM_OPTIONS, HUM_CORRECT, HUM_EXPLANATION, 'history');
    expect(issues).toEqual([]);
  });

  it('still flags a correct answer the explanation does not reference at all (threshold not gutted)', () => {
    const offTopic =
      'Великий Шёлковый путь проходил через территорию Казахстана и способствовал ' +
      'развитию торговли между Востоком и Западом.';
    const options = [
      'Усиление центральной власти и ослабление родовой знати', // correct (index 0)
      'Принятие ислама в качестве государственной религии',
      'Создание регулярной профессиональной армии',
      'Отмена налоговых льгот для духовенства',
    ];
    expect(checkExplanationMismatch(HUM_Q, options, 0, offTopic)).toBeTruthy();
  });
});

describe('checkExplanationMismatch — numeric wrong-key still caught', () => {
  const Q = 'Чему равна площадь прямоугольника со сторонами 4 см и 6 см?';
  const OPTIONS = ['12 см²', '24 см²', '48 см²', '36 см²'];
  // Explanation correctly computes 24 (option 1) but the key is marked 0 ("12 см²").
  const EXPLANATION =
    'Площадь прямоугольника равна произведению сторон: 4 × 6 = 24 см². ' +
    'Значит, площадь равна 24 квадратным сантиметрам.';

  it('detects the explanation concluding a different (wrong-key) numeric value', () => {
    const mismatch = checkExplanationMismatch(Q, OPTIONS, 0, EXPLANATION);
    expect(mismatch).toBeTruthy();
    expect(mismatch).toContain('24');
  });

  it('checkGenerated surfaces the mismatch as a quality issue', () => {
    const issues = checkGenerated(Q, OPTIONS, 0, EXPLANATION, 'math_profile');
    expect(issues.some(i => i.includes('Несоответствие'))).toBe(true);
  });

  it('passes when the marked key matches the computed value', () => {
    // same explanation, but the key now correctly points at "24 см²" (index 1)
    expect(checkExplanationMismatch(Q, OPTIONS, 1, EXPLANATION)).toBeNull();
  });
});
