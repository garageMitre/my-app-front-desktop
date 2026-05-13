export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  createdAt?: string;
}

export interface CreateCategoryDto {
  name: string;
  icon?: string;
  color?: string;
}

export type ExpenseType = 'FIXED' | 'VARIABLE';

export type MoneyType = 'ARS' | 'USD';


export interface Expense {
  id: number;
  description: string;
  amount: number;
  date: string;
  type: ExpenseType;
  moneyType: MoneyType;
  usdToArsRate?: number | null;
  isRecurring: boolean;
  recurringDay: number | null;
  category?: Category;
  categoryId?: number;
  fromAccount?: string;
  importSource?: string | null;
  createdAt?: string;
}

export interface CreateExpenseDto {
  description: string;
  amount: number;
  date: string;
  type: ExpenseType;
  moneyType: MoneyType;
  isRecurring?: boolean;
  recurringDay?: number;
  categoryId: number;
  fromAccount?: string;
}

export type UpdateExpenseDto = Partial<CreateExpenseDto>;

export interface QueryExpenseDto {
  from?: string;
  to?: string;
  type?: ExpenseType;
  categoryId?: number;
}

export interface DayPoint {
  date: string;
  day: number;
  label: string;
  total: number;
  fijos: number;
  variables: number;
}

export interface DashboardSummary {
  thisMonth: { total: number; fijos: number; variables: number };
  lastMonth: { total: number };
  byCat: (Category & { total: number })[];
  byDate: DayPoint[];
  monthExpenses: Expense[];
  recientes: Expense[];
}

// Legacy alias
export type ExpenseDto = CreateExpenseDto;

export type IncomeSource = 'SALARY' | 'FREELANCE' | 'TRANSFER' | 'REFUND' | 'OTHER';

export interface Income {
  id: number;
  description: string;
  amount: number;
  date: string;
  moneyType: MoneyType;
  usdToArsRate?: number | null;
  source: IncomeSource;
  externalId?: string | null;
  fromAccount?: string;
  importSource?: string | null;
  createdAt?: string;
}

export interface CreateIncomeDto {
  description: string;
  amount: number;
  date: string;
  moneyType?: MoneyType;
  source?: IncomeSource;
  fromAccount?: string;
}


export type ReminderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

export interface Reminder {
  id: string;
  email: string;
  description: string;
  remindAt: string;
  notifyBeforeMinutes: number;
  notifyAt: string;
  status: ReminderStatus;
  sentAt?: string | null;
  lastError?: string | null;
  retryCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateReminderDto {
  email: string;
  description: string;
  remindAt: string;
  notifyBeforeMinutes: number;
}