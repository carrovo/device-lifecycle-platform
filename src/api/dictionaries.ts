import { apiRequest } from './client';

export const getBusinessDictionaries = () => apiRequest('/api/dictionaries');
