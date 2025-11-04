// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Text input validation
export const validateTextInput = (text, minLength = 1, maxLength = 1000) => {
  if (!text || text.trim().length < minLength) {
    return { valid: false, error: `Minimum ${minLength} characters required` };
  }
  if (text.length > maxLength) {
    return { valid: false, error: `Maximum ${maxLength} characters allowed` };
  }
  return { valid: true };
};

// Candidate ID validation
export const isValidCandidateId = (id) => {
  return id && id.length >= 3 && /^[A-Z0-9_-]+$/i.test(id);
};

// Audio file validation
export const validateAudioFile = (file) => {
  const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid audio format' };
  }
  if (file.size > maxSize) {
    return { valid: false, error: 'File too large (max 10MB)' };
  }
  return { valid: true };
};