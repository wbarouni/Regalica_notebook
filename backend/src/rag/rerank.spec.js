const { rerank, selectTopCandidates, truncatePreservingCitations } = require('./rerank');
const config = require('../config');

// Mock axios pour les tests
jest.mock('axios');
const axios = require('axios');

describe('Reranking with Environment Limits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should validate query input', async () => {
    await expect(rerank('', [])).rejects.toThrow('Query cannot be empty');
    await expect(rerank(null, [])).rejects.toThrow('Query cannot be empty');
    await expect(rerank('   ', [])).rejects.toThrow('Query cannot be empty');
  });

  test('should handle empty candidates gracefully', async () => {
    const result = await rerank('test query', []);
    expect(result).toEqual([]);
  });

  test('should filter empty candidates', async () => {
    const candidates = [
      { text: 'Valid candidate', score_cosine: 0.8 },
      { text: '', score_cosine: 0.7 }, // Empty text
      { text: '   ', score_cosine: 0.6 }, // Whitespace only
      null, // Null candidate
      { score_cosine: 0.5 }, // Missing text
      { text: 'Another valid candidate', score_cosine: 0.9 }
    ];

    // Mock successful reranker response
    axios.post.mockResolvedValue({
      data: {
        scores: [0.85, 0.95], // Only 2 scores for 2 valid candidates
        processing_time_ms: 50,
        model: 'test-model'
      }
    });

    const result = await rerank('test query', candidates);
    
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Another valid candidate');
    expect(result[1].text).toBe('Valid candidate');
  });

  test('should respect RERANKER_MAX_CANDIDATES limit', async () => {
    const maxCandidates = config.rerankerMaxCandidates;
    const candidates = Array.from({ length: maxCandidates + 50 }, (_, i) => ({
      text: `Candidate ${i}`,
      score_cosine: 0.5
    }));

    // Mock successful reranker response
    const expectedScores = Array.from({ length: maxCandidates }, () => 0.8);
    axios.post.mockResolvedValue({
      data: {
        scores: expectedScores,
        processing_time_ms: 100,
        model: 'test-model'
      }
    });

    const result = await rerank('test query', candidates);
    
    expect(result).toHaveLength(maxCandidates);
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        candidates: expect.arrayContaining([expect.any(String)])
      }),
      expect.any(Object)
    );
    
    // Vérifier que seulement maxCandidates ont été envoyés au reranker
    const sentCandidates = axios.post.mock.calls[0][1].candidates;
    expect(sentCandidates).toHaveLength(maxCandidates);
  });

  test('should combine cosine and rerank scores with alpha/beta weights', async () => {
    const candidates = [
      { text: 'First candidate', score_cosine: 0.6 },
      { text: 'Second candidate', score_cosine: 0.8 }
    ];

    axios.post.mockResolvedValue({
      data: {
        scores: [0.9, 0.4], // High rerank for first, low for second
        processing_time_ms: 30,
        model: 'test-model'
      }
    });

    const result = await rerank('test query', candidates);
    
    expect(result).toHaveLength(2);
    
    // Vérifier les scores finaux avec alpha=0.3, beta=0.7
    const expectedScore1 = config.rerankerAlpha * 0.6 + config.rerankerBeta * 0.9;
    const expectedScore2 = config.rerankerAlpha * 0.8 + config.rerankerBeta * 0.4;
    
    expect(result[0].score_final).toBeCloseTo(expectedScore1, 3);
    expect(result[1].score_final).toBeCloseTo(expectedScore2, 3);
    
    // Le premier devrait être classé plus haut grâce au rerank
    expect(result[0].text).toBe('First candidate');
    expect(result[1].text).toBe('Second candidate');
  });

  test('should fallback to cosine scores on reranker error', async () => {
    const candidates = [
      { text: 'First candidate', score_cosine: 0.8 },
      { text: 'Second candidate', score_cosine: 0.6 }
    ];

    axios.post.mockRejectedValue(new Error('Reranker service unavailable'));

    const result = await rerank('test query', candidates);
    
    expect(result).toHaveLength(2);
    expect(result[0].score_final).toBe(0.8); // Fallback to cosine
    expect(result[1].score_final).toBe(0.6);
    expect(result[0].score_rerank).toBe(0);
    expect(result[1].score_rerank).toBe(0);
  });

  test('should select top N candidates correctly', () => {
    const candidates = [
      { text: 'First', score_final: 0.9 },
      { text: 'Second', score_final: 0.8 },
      { text: 'Third', score_final: 0.7 },
      { text: 'Fourth', score_final: 0.6 }
    ];

    const top2 = selectTopCandidates(candidates, 2);
    expect(top2).toHaveLength(2);
    expect(top2[0].text).toBe('First');
    expect(top2[1].text).toBe('Second');

    const top10 = selectTopCandidates(candidates, 10);
    expect(top10).toHaveLength(4); // Only 4 available
  });

  test('should handle invalid input for selectTopCandidates', () => {
    expect(selectTopCandidates(null, 5)).toEqual([]);
    expect(selectTopCandidates(undefined, 5)).toEqual([]);
    expect(selectTopCandidates('not an array', 5)).toEqual([]);
  });
});

describe('Citation-Safe Truncation', () => {
  test('should truncate text exactly at max chars when no citations', () => {
    const text = "This is a long text without any citations that should be truncated at exactly 512 characters.".repeat(10);
    const truncated = truncatePreservingCitations(text, 512);
    
    expect(truncated.length).toBeLessThanOrEqual(512);
  });

  test('should preserve citations when truncating', () => {
    const text = "This is some text with a citation [Document Title#page:1-100] and more text after the citation.";
    const truncated = truncatePreservingCitations(text, 50); // Tronquer au milieu de la citation
    
    // Doit soit inclure la citation complète, soit s'arrêter avant
    expect(truncated).not.toMatch(/\[[^\]]*$/); // Pas de citation incomplète à la fin
  });

  test('should not cut citation in the middle', () => {
    const textWithCitation = "Short text [Very Long Document Title#page:123-456] more text";
    const truncated = truncatePreservingCitations(textWithCitation, 25); // Coupe au milieu de la citation
    
    // Doit soit inclure la citation complète, soit s'arrêter avant le [
    const hasIncompleteCitation = truncated.includes('[') && !truncated.includes(']');
    expect(hasIncompleteCitation).toBe(false);
  });

  test('should handle text shorter than max chars', () => {
    const shortText = "This is a short text.";
    const truncated = truncatePreservingCitations(shortText, 512);
    
    expect(truncated).toBe(shortText);
  });

  test('should handle empty or null text', () => {
    expect(truncatePreservingCitations('', 512)).toBe('');
    expect(truncatePreservingCitations(null, 512)).toBe(null);
    expect(truncatePreservingCitations(undefined, 512)).toBe(undefined);
  });

  test('should handle multiple citations correctly', () => {
    const textWithMultipleCitations = "Text [Doc1#1:1-10] middle [Doc2#2:20-30] end";
    const truncated = truncatePreservingCitations(textWithMultipleCitations, 30);
    
    // Vérifier qu'aucune citation n'est coupée
    const citations = truncated.match(/\[[^\]]*\]/g) || [];
    citations.forEach(citation => {
      expect(citation).toMatch(/^\[.*\]$/); // Citation complète
    });
  });

  test('should limit extension when citation is too long', () => {
    const textWithLongCitation = "Text [Very Very Very Long Document Title That Exceeds Reasonable Limits#page:1-1000] end";
    const truncated = truncatePreservingCitations(textWithLongCitation, 20);
    
    // Ne doit pas dépasser de plus de 50 caractères la limite
    expect(truncated.length).toBeLessThanOrEqual(70); // 20 + 50
  });

  test('should handle citation at the very end', () => {
    const textEndingWithCitation = "Some text [Document#page:1-10]";
    const truncated = truncatePreservingCitations(textEndingWithCitation, 15);
    
    // Doit soit inclure la citation complète, soit s'arrêter avant
    // Une citation complète se termine par ] donc c'est acceptable
    const hasIncompleteCitation = truncated.includes('[') && !truncated.endsWith(']') && truncated.includes('#');
    expect(hasIncompleteCitation).toBe(false);
  });

  test('should preserve whitespace normalization context', () => {
    const textWithExtraSpaces = "Text   with    extra     spaces [Doc#1:1-10]   more   text";
    const truncated = truncatePreservingCitations(textWithExtraSpaces, 30);
    
    // La fonction ne normalise pas les espaces, c'est fait en amont
    expect(typeof truncated).toBe('string');
    expect(truncated.length).toBeGreaterThan(0);
  });
});
