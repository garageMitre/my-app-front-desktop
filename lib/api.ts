import { Category, Expense, ExpenseDto } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  categories: {
    getAll: () => request<Category[]>('/categories'),
    create: (dto: { name: string; color: string; icon: string }) =>
      request<Category>('/categories', { method: 'POST', ...json(dto) }),
    remove: (id: number) =>
      request<void>(`/categories/${id}`, { method: 'DELETE' }),
  },
  expenses: {
    getAll: () => request<Expense[]>('/expenses'),
    create: (dto: ExpenseDto) =>
      request<Expense>('/expenses', { method: 'POST', ...json(dto) }),
    update: (id: number, dto: Partial<ExpenseDto>) =>
      request<Expense>(`/expenses/${id}`, { method: 'PATCH', ...json(dto) }),
    remove: (id: number) =>
      request<void>(`/expenses/${id}`, { method: 'DELETE' }),
  },
};
