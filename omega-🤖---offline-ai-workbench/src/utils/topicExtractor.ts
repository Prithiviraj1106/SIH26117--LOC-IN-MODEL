/**
 * Extracts a concise, high-level topic title for a conversation
 * based on user input, capability category, and attached context.
 */
export function extractConversationTopic(
  userText: string,
  category: 'General' | 'Coding' | 'Vision' | 'Document RAG' | 'Chatbot',
  docName?: string
): string {
  if (category === 'Document RAG' && docName) {
    const cleanDoc = docName.replace(/\.[^/.]+$/, '').trim();
    return `Doc: ${cleanDoc.slice(0, 26)}`;
  }

  const raw = userText.trim();
  if (!raw) {
    if (category === 'Vision') return 'Visual Analysis';
    if (category === 'Document RAG') return 'Document Query';
    if (category === 'Coding') return 'Code Generation';
    return 'New Conversation';
  }

  // If multi-line, focus on the first meaningful line
  let firstLine = raw.split('\n')[0].trim();

  // Remove markdown symbols and common pleasantry / conversational inquiry prefixes
  let topic = firstLine
    .replace(/^[\s,.;:!?\-—#*`]+/, '')
    .replace(
      /^(can you please|could you please|please|kindly|would you|can you|could you|help me with|help me|tell me about|tell me|explain to me|explain|what is the|what is|what are the|what are|what's|how do i|how can i|how to|write a program to|write a script to|write a|write an|build a|create a|generate a|macha|bro|hey|hello|hi)[\s,.:;!?]+/i,
      ''
    )
    .replace(
      /^(can you please|could you please|please|kindly|would you|can you|could you|help me with|help me|tell me about|tell me|explain to me|explain|what is the|what is|what are the|what are|what's|how do i|how can i|how to|write a|write an|build a|create a|generate a)[\s,.:;!?]+/i,
      ''
    )
    .trim();

  // Fallback if stripped too aggressively
  if (topic.length < 3) {
    topic = firstLine;
  }

  // Remove trailing punctuation
  topic = topic.replace(/[?.:;!,`]+$/, '').trim();

  // Capitalize first character
  if (topic.length > 0) {
    topic = topic.charAt(0).toUpperCase() + topic.slice(1);
  }

  // Limit topic length for pristine layout rendering
  if (topic.length > 36) {
    topic = topic.slice(0, 36).trim() + '...';
  }

  return topic || 'Conversation';
}
