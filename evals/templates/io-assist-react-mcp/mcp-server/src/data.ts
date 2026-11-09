export interface Client {
  id: string;
  name: string;
  segment: "retail" | "private" | "corporate";
  advisorId: string;
}

export interface Holding {
  symbol: string;
  quantity: number;
  price: number;
}

export interface Transaction {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  description: string;
}

export interface Payment {
  id: string;
  clientId: string;
  amount: number;
  currency: string;
  beneficiary: string;
  status: "submitted";
}

export const clients: Client[] = [
  { id: "c-100", name: "Jane Holloway", segment: "private", advisorId: "acme-advisor" },
  { id: "c-101", name: "Marcus Lee", segment: "retail", advisorId: "acme-advisor" },
  { id: "c-102", name: "Northwind Ltd", segment: "corporate", advisorId: "other-advisor" },
];

export const portfolios: Record<string, Holding[]> = {
  "c-100": [
    { symbol: "AAPL", quantity: 120, price: 228.4 },
    { symbol: "MSFT", quantity: 80, price: 431.2 },
  ],
  "c-101": [{ symbol: "VOO", quantity: 15, price: 512.9 }],
  "c-102": [
    { symbol: "TLT", quantity: 900, price: 91.3 },
    { symbol: "GLD", quantity: 300, price: 241.7 },
  ],
};

export const transactions: Transaction[] = [
  { id: "t-1", clientId: "c-100", date: "2026-09-02", amount: -4200, description: "Wire to Brokerage" },
  { id: "t-2", clientId: "c-100", date: "2026-09-15", amount: 12500, description: "Dividend" },
  { id: "t-3", clientId: "c-101", date: "2026-09-20", amount: -350, description: "Card payment" },
  { id: "t-4", clientId: "c-102", date: "2026-09-28", amount: -98000, description: "Supplier invoice" },
];

export const payments: Payment[] = [];
