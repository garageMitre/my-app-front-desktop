import type { Category, CreateCategoryDto, Expense, CreateExpenseDto, UpdateExpenseDto, QueryExpenseDto, DashboardSummary, DayPoint, Income, CreateIncomeDto, Reminder, CreateReminderDto } from '@/lib/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

const json = (body: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function buildQuery(params: Record<string, string | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return q ? `?${q}` : '';
}

export const categoriesService = {
  getAll: () => request<Category[]>('/categories'),
  create: (dto: CreateCategoryDto) =>
    request<Category>('/categories', { method: 'POST', ...json(dto) }),
  update: (id: number, dto: Partial<CreateCategoryDto>) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', ...json(dto) }),
  remove: (id: number) =>
    request<void>(`/categories/${id}`, { method: 'DELETE' }),
};

export const expensesService = {
  getAll: (query?: QueryExpenseDto) => {
    const qs = buildQuery({ from: query?.from, to: query?.to });
    return request<Expense[]>(`/expenses${qs}`);
  },
  getTotals: async (query?: QueryExpenseDto): Promise<{ category: string; total: number }[]> => {
    try {
      const qs = buildQuery({ from: query?.from, to: query?.to });
      return await request<{ category: string; total: number }[]>(`/expenses/totals${qs}`);
    } catch {
      return [];
    }
  },
  create: (dto: CreateExpenseDto) =>
    request<Expense>('/expenses', { method: 'POST', ...json(dto) }),
  update: (id: number, dto: UpdateExpenseDto) =>
    request<Expense>(`/expenses/${id}`, { method: 'PATCH', ...json(dto) }),
  remove: (id: number) =>
    request<void>(`/expenses/${id}`, { method: 'DELETE' }),
};

export const incomesService = {
  getAll: (from?: string, to?: string) => {
    const q = [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join('&');
    return request<Income[]>(`/incomes${q ? `?${q}` : ''}`);
  },
  create: (dto: CreateIncomeDto) =>
    request<Income>('/incomes', { method: 'POST', ...json(dto) }),
  update: (id: number, dto: Partial<CreateIncomeDto>) =>
    request<Income>(`/incomes/${id}`, { method: 'PATCH', ...json(dto) }),
  remove: (id: number) =>
    request<void>(`/incomes/${id}`, { method: 'DELETE' }),
};

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function n(v: unknown): number { return Number(v) || 0; }

function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return { from, to };
}

export const dashboardService = {
  async getSummary(year: number, month: number): Promise<DashboardSummary> {
    const thisRange = monthRange(year, month);
    const lastDate = new Date(year, month - 2, 1);
    const lastRange = monthRange(lastDate.getFullYear(), lastDate.getMonth() + 1);

    const [thisExpenses, lastExpenses, totalsThisMonth, categories] = await Promise.all([
      expensesService.getAll({ from: thisRange.from, to: thisRange.to }),
      expensesService.getAll({ from: lastRange.from, to: lastRange.to }),
      expensesService.getTotals({ from: thisRange.from, to: thisRange.to }),
      categoriesService.getAll(),
    ]);

    const total     = thisExpenses.reduce((s, e) => s + n(e.amount), 0);
    const fijos     = thisExpenses.filter(e => e.type === 'FIXED').reduce((s, e) => s + n(e.amount), 0);
    const variables = thisExpenses.filter(e => e.type === 'VARIABLE').reduce((s, e) => s + n(e.amount), 0);
    const lastTotal = lastExpenses.reduce((s, e) => s + n(e.amount), 0);

    const byCat = totalsThisMonth.length > 0
      ? totalsThisMonth
          .map(t => {
            const cat = categories.find(c => c.name === t.category)
              ?? { id: 0, name: t.category || 'Sin cat.', icon: '💰', color: '#6C63FF' };
            return { id: cat.id, name: cat.name ?? 'Sin cat.', icon: cat.icon ?? '💰', color: cat.color ?? '#6C63FF', total: n(t.total) };
          })
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total)
      : categories
          .map(c => ({
            ...c,
            total: thisExpenses
              .filter(e => String(e.category?.id ?? e.categoryId) === String(c.id))
              .reduce((s, e) => s + n(e.amount), 0),
          }))
          .filter(c => c.total > 0)
          .sort((a, b) => b.total - a.total);

    const dayMap: Record<string, DayPoint> = {};
    for (const e of thisExpenses) {
      const date = e.date.split('T')[0];
      const day = Number(date.split('-')[2]);
      const mes = MESES[Number(date.split('-')[1]) - 1];
      if (!dayMap[date]) {
        dayMap[date] = { date, day, label: `${day} ${mes}`, total: 0, fijos: 0, variables: 0 };
      }
      const amt = n(e.amount);
      dayMap[date].total += amt;
      if (e.type === 'FIXED') dayMap[date].fijos += amt;
      else dayMap[date].variables += amt;
    }
    const byDate = Object.values(dayMap).sort((a, b) => a.day - b.day);

    const monthExpenses = [...thisExpenses].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (diff !== 0) return diff;
      }
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return dateDiff !== 0 ? dateDiff : b.id - a.id;
    });

    return {
      thisMonth: { total, fijos, variables },
      lastMonth: { total: lastTotal },
      byCat,
      byDate,
      monthExpenses,
      recientes: monthExpenses.slice(0, 5),
    };
  },
};

export const remindersService = {
  async getAll(): Promise<Reminder[]> {
    const res = await fetch(`${BASE}/reminders`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Error obteniendo recordatorios');
    }

    return res.json();
  },

  async create(dto: CreateReminderDto): Promise<Reminder> {
    const res = await fetch(`${BASE}/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });

    if (!res.ok) {
      throw new Error('Error creando recordatorio');
    }

    return res.json();
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`${BASE}/reminders/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Error eliminando recordatorio');
    }
  },

  async cancel(id: string): Promise<Reminder> {
    const res = await fetch(`${BASE}/reminders/${id}/cancel`, {
      method: 'PATCH',
    });

    if (!res.ok) {
      throw new Error('Error cancelando recordatorio');
    }

    return res.json();
  },
};