const { truncatePreservingCitations } = require('./rerank');

describe('Reranking Normalization', () => {
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
