import {
  getUserFriendlyMessage,
  getErrorType,
  ErrorType,
  validateRequiredFields,
  safeJSONParse
} from './errorHandling';

describe('errorHandling', () => {
  describe('getUserFriendlyMessage', () => {
    it('should return friendly message for auth errors', () => {
      const error = { code: 'auth/user-not-found' };
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('User not found. Please check your email address.');
    });

    it('should return friendly message for permission denied', () => {
      const error = { code: 'permission-denied' };
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('You do not have permission to perform this action.');
    });

    it('should return friendly message for network errors', () => {
      const error = { code: 'unavailable' };
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Network error. Please check your internet connection.');
    });

    it('should return context-specific message when provided', () => {
      const error = { code: 'not-found' };
      const message = getUserFriendlyMessage(error, 'Booking');
      expect(message).toBe('Booking not found.');
    });

    it('should return default message for unknown errors', () => {
      const error = { message: 'Unknown error' };
      const message = getUserFriendlyMessage(error, 'save');
      expect(message).toBe('Failed to save. Please try again.');
    });

    it('should handle validation errors', () => {
      const error = { message: 'Email is required' };
      const message = getUserFriendlyMessage(error);
      expect(message).toBe('Email is required');
    });
  });

  describe('getErrorType', () => {
    it('should identify auth errors', () => {
      const error = { code: 'auth/invalid-credential' };
      expect(getErrorType(error)).toBe(ErrorType.AUTH);
    });

    it('should identify permission errors', () => {
      const error = { code: 'permission-denied' };
      expect(getErrorType(error)).toBe(ErrorType.PERMISSION);
    });

    it('should identify not found errors', () => {
      const error = { code: 'not-found' };
      expect(getErrorType(error)).toBe(ErrorType.NOT_FOUND);
    });

    it('should identify network errors', () => {
      const error = { code: 'unavailable' };
      expect(getErrorType(error)).toBe(ErrorType.NETWORK);
    });

    it('should identify Firebase errors', () => {
      const error = { code: 'firestore/unavailable' };
      expect(getErrorType(error)).toBe(ErrorType.FIREBASE);
    });

    it('should identify validation errors', () => {
      const error = { message: 'validation failed: email is required' };
      expect(getErrorType(error)).toBe(ErrorType.VALIDATION);
    });

    it('should default to unknown for unrecognized errors', () => {
      const error = { message: 'Something weird happened' };
      expect(getErrorType(error)).toBe(ErrorType.UNKNOWN);
    });
  });

  describe('validateRequiredFields', () => {
    it('should pass validation when all fields are present', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890'
      };
      const requiredFields = ['name', 'email', 'phone'];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail validation when fields are missing', () => {
      const data = {
        name: 'John Doe'
      };
      const requiredFields = ['name', 'email', 'phone'];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required fields');
      expect(result.error).toContain('email');
      expect(result.error).toContain('phone');
    });

    it('should fail validation for empty strings', () => {
      const data = {
        name: 'John Doe',
        email: ''
      };
      const requiredFields = ['name', 'email'];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('email');
    });

    it('should fail validation for null values', () => {
      const data = {
        name: 'John Doe',
        email: null
      };
      const requiredFields = ['name', 'email'];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(false);
    });

    it('should validate nested fields using dot notation', () => {
      const data = {
        user: {
          profile: {
            name: 'John Doe'
          }
        }
      };
      const requiredFields = ['user.profile.name'];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(true);
    });

    it('should fail validation for missing nested fields', () => {
      const data = {
        user: {
          profile: {}
        }
      };
      const requiredFields = ['user.profile.name'];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('user.profile.name');
    });

    it('should handle empty required fields array', () => {
      const data = { name: 'John' };
      const requiredFields = [];

      const result = validateRequiredFields(data, requiredFields);

      expect(result.valid).toBe(true);
    });
  });

  describe('safeJSONParse', () => {
    it('should parse valid JSON', () => {
      const json = '{"name":"John","age":30}';
      const result = safeJSONParse(json);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should return default value for invalid JSON', () => {
      const json = '{invalid json}';
      const defaultValue = { error: true };
      const result = safeJSONParse(json, defaultValue);

      expect(result).toEqual(defaultValue);
    });

    it('should return null as default when not specified', () => {
      const json = '{invalid json}';
      const result = safeJSONParse(json);

      expect(result).toBeNull();
    });

    it('should handle empty strings', () => {
      const result = safeJSONParse('', []);

      expect(result).toEqual([]);
    });

    it('should parse arrays', () => {
      const json = '[1,2,3,4,5]';
      const result = safeJSONParse(json);

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should parse complex nested objects', () => {
      const json = '{"user":{"profile":{"name":"John","roles":["admin","user"]}}}';
      const result = safeJSONParse(json);

      expect(result).toEqual({
        user: {
          profile: {
            name: 'John',
            roles: ['admin', 'user']
          }
        }
      });
    });
  });
});
