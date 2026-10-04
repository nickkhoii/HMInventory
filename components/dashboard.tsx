"use client";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import {
  Package,
  ArrowUpRight,
  TriangleAlert,
  ArrowDownToLine,
  Plus,
} from "lucide-react";
import { Badge, money, date, Empty } from "./ui";
import type { Item, Transaction, BorrowRecord } from "./types";
export type DashboardData = {
  cards: Record<string, number>;
  low: Item[];
  transactions: Transaction[];
  byCategory: { name: string; value: number }[];
  byCondition: { name: string; value: number }[];
  movements: { name: string; in: number; out: number }[];
  valuation: string;
  dueBorrowing: BorrowRecord[];
};
const colors = [
  "#ff8800",
  "#ffb366",
  "#d0b47b",
  "#e18e78",
  "#8399b7",
  "#9d8abb",
  "#a5bd72",
];
export function Dashboard({ data }: { data: DashboardData }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LABORATORY OVERVIEW</span>
          <h1>Dashboard</h1>
          <p>Your inventory at a glance. Everything in its place.</p>
        </div>
        <Link className="button" href="/inventory">
          <Plus size={17} />
          Manage inventory
        </Link>
      </div>
      <div className="overview-banner">
        <div>
          <span className="eyebrow">TOTAL INVENTORY VALUE</span>
          <h2>{money(data.valuation)}</h2>
          <p>Based on current quantities and recorded unit costs</p>
        </div>
        <div className="banner-icon">
          <Package size={42} />
        </div>
      </div>
      <div className="stats-grid">
        {Object.entries(data.cards).map(([title, value], i) => (
          <div className="stat-card" key={title}>
            <div>
              <span>{title}</span>
              <span className={`stat-icon tone-${i % 3}`}>
                <Package size={16} />
              </span>
            </div>
            <strong>{value.toLocaleString()}</strong>
            <small>
              {[
                "Low stock items",
                "Out of stock",
                "Overdue Transactions",
                "Items Due Today",
              ].includes(title)
                ? "Requires attention"
                : "Current laboratory records"}
            </small>
          </div>
        ))}
      </div>
      <section className="panel due-borrowing">
        <div className="panel-heading">
          <div>
            <h2>Due / Overdue Items</h2>
            <p>Open loans due today or earlier</p>
          </div>
          <Link className="text-link" href="/return-items">
            View open loans
          </Link>
        </div>
        {data.dueBorrowing.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Borrower</th>
                  <th>Date borrowed</th>
                  <th>Expected return</th>
                  <th>Days overdue</th>
                  <th>Outstanding items</th>
                </tr>
              </thead>
              <tbody>
                {data.dueBorrowing.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/borrowing/${b.id}`} className="text-link">
                        {b.transactionNumber}
                      </Link>
                      <small>
                        <Badge value={b.status} />
                      </small>
                    </td>
                    <td>{b.borrowerName}</td>
                    <td>{date(b.borrowedDate)}</td>
                    <td>{date(b.expectedReturnDate)}</td>
                    <td>{b.daysOverdue}</td>
                    <td>
                      {b.quantityOutstanding} units
                      <small>
                        {b.items
                          .filter((i) => i.quantityOutstanding > 0)
                          .map(
                            (i) => `${i.itemName} (${i.quantityOutstanding})`,
                          )
                          .join(", ")}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No loans are due or overdue" />
        )}
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Inventory by category</h2>
              <p>Quantity across your inventory categories</p>
            </div>
            <span className="subtle-tag">Units</span>
          </div>
          {data.byCategory.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.byCategory}
                  layout="vertical"
                  margin={{ left: 10, right: 24 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={125}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    isAnimationActive={false}
                    dataKey="value"
                    fill="#ff8800"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Inventory condition</h2>
              <p>The condition of your laboratory assets</p>
            </div>
          </div>
          {data.byCondition.length ? (
            <>
              <div className="chart donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={data.byCondition}
                      dataKey="value"
                      innerRadius={65}
                      outerRadius={94}
                      paddingAngle={4}
                    >
                      {data.byCondition.map((c, i) => (
                        <Cell key={c.name} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend">
                {data.byCondition.map((c, i) => (
                  <span key={c.name}>
                    <i style={{ background: colors[i % colors.length] }} />
                    {c.name}
                    <strong>{c.value}</strong>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Stock movement</h2>
              <p>Incoming and outgoing units over the last 30 days</p>
            </div>
            <span className="subtle-tag">30 days</span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.movements}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  isAnimationActive={false}
                  name="Stock in"
                  type="monotone"
                  dataKey="in"
                  stroke="#ff8800"
                  fill="#ff8800"
                  fillOpacity={0.13}
                />
                <Area
                  isAnimationActive={false}
                  name="Stock out"
                  type="monotone"
                  dataKey="out"
                  stroke="#d0a060"
                  fill="#d0a060"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                <TriangleAlert size={17} />
                Stock alerts
              </h2>
              <p>Items at or below their minimum level</p>
            </div>
            <Link href="/inventory?stock=ATTENTION" className="text-link">
              View all
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {data.low.length ? (
            <div className="alert-list">
              {data.low.slice(0, 5).map((i) => (
                <Link key={i.id} href={`/inventory/${i.id}`}>
                  <span className="item-icon">
                    <Package size={18} />
                  </span>
                  <div>
                    <strong>{i.name}</strong>
                    <small>
                      {i.inventoryCode} · Minimum {i.minimumStock}
                    </small>
                  </div>
                  <Badge
                    value={
                      i.availableQuantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK"
                    }
                  />
                  <strong>{i.availableQuantity}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <Empty text="All stock levels are healthy" />
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Recent transactions</h2>
            <p>The latest movements in your laboratory</p>
          </div>
          <Link href="/transactions" className="text-link">
            View history
            <ArrowUpRight size={15} />
          </Link>
        </div>
        {data.transactions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Movement</th>
                  <th>Quantity</th>
                  <th>Available</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/inventory/${t.itemId}`}>
                        <strong>{t.item.name}</strong>
                        <small>{t.item.inventoryCode}</small>
                      </Link>
                    </td>
                    <td>
                      <Badge value={t.type} />
                    </td>
                    <td>{t.quantity}</td>
                    <td>{t.newAvailable}</td>
                    <td>{date(t.transactionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Your stock movements will appear here" />
        )}
      </section>
      <div className="quick-actions">
        <Link href="/stock-in">
          <ArrowDownToLine size={18} />
          Record incoming stock
          <ArrowUpRight size={16} />
        </Link>
        <Link href="/reports">
          Generate a laboratory report
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </>
  );
}
