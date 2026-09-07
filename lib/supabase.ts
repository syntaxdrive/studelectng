/**
 * StudElect Native Supabase Client
 * Direct REST interface with AbortController timeout on every request.
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lurbrcgeivofalftahhj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cmJyY2dlaXZvZmFsZnRhaGhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzAwMDQsImV4cCI6MjEwMjU0NjAwNH0.4B6-ub0B6m4uE3ilCtVjcQ1RYRy2a4Pz8Qwb1no1DTU";

const FETCH_TIMEOUT_MS = 6000; // 6 seconds max per request

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const key =
    (typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY)
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : SUPABASE_ANON_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Make a fetch with a hard timeout. Throws on timeout. */
async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export class SupabaseQueryBuilder {
  private table: string;
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private selectedColumns: string = "*";
  private isSingleResult: boolean = false;
  private sortColumn?: string;
  private sortAsc: boolean = true;
  private limitCount?: number;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    this.selectedColumns = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, operator: "in", value: `(${values.join(",")})` });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ column, operator: "ilike", value: pattern });
    return this;
  }

  or(filter: string) {
    this.filters.push({ column: "or", operator: "", value: `(${filter})` });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  order(column: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.sortColumn = column;
    this.sortAsc = ascending;
    return this;
  }

  single() {
    this.isSingleResult = true;
    return this;
  }

  maybeSingle() {
    this.isSingleResult = true;
    return this;
  }

  async then(resolve: (value: { data: any; error: any }) => void) {
    try {
      const url = new URL(`${SUPABASE_URL}/rest/v1/${this.table}`);
      url.searchParams.append("select", this.selectedColumns);

      for (const filter of this.filters) {
        if (filter.column === "or") {
          url.searchParams.append("or", filter.value);
        } else {
          url.searchParams.append(filter.column, `${filter.operator}.${filter.value}`);
        }
      }

      if (this.sortColumn) {
        url.searchParams.append(
          "order",
          `${this.sortColumn}.${this.sortAsc ? "asc" : "desc"}`
        );
      }

      if (this.limitCount !== undefined) {
        url.searchParams.append("limit", String(this.limitCount));
      }

      const headers = getHeaders(
        this.isSingleResult ? { Prefer: "return=representation" } : undefined
      );

      const res = await fetchWithTimeout(url.toString(), {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (!res.ok) {
        const errorText = await res.text();
        resolve({ data: null, error: { message: errorText, status: res.status } });
        return;
      }

      const json = await res.json();
      const result =
        this.isSingleResult && Array.isArray(json) ? json[0] ?? null : json;
      resolve({ data: result, error: null });
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      resolve({
        data: null,
        error: {
          message: isTimeout
            ? "Supabase request timed out after 6s."
            : err.message || "Network request failed.",
        },
      });
    }
  }

  async insert(values: any | any[]) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${this.table}`;
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: getHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { data: null, error: { message: errText, status: res.status } };
      }

      const data = await res.json();
      return { data, error: null };
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        data: null,
        error: {
          message: isTimeout ? "Supabase insert timed out." : err.message,
        },
      };
    }
  }

  async upsert(values: any | any[]) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${this.table}`;
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: getHeaders({
          Prefer: "resolution=merge-duplicates,return=representation",
        }),
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { data: null, error: { message: errText, status: res.status } };
      }

      const data = await res.json();
      return { data, error: null };
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      return {
        data: null,
        error: {
          message: isTimeout ? "Supabase upsert timed out." : err.message,
        },
      };
    }
  }

  update(values: any) {
    const table = this.table;
    const filters = [...this.filters];

    const executor = {
      eq(column: string, value: any) {
        filters.push({ column, operator: "eq", value });
        return executor;
      },
      neq(column: string, value: any) {
        filters.push({ column, operator: "neq", value });
        return executor;
      },
      in(column: string, values: any[]) {
        filters.push({ column, operator: "in", value: `(${values.join(",")})` });
        return executor;
      },
      ilike(column: string, pattern: string) {
        filters.push({ column, operator: "ilike", value: pattern });
        return executor;
      },
      async then(resolve: (value: { data: any; error: any }) => void) {
        try {
          const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
          for (const f of filters) {
            url.searchParams.append(f.column, `${f.operator}.${f.value}`);
          }

          const res = await fetchWithTimeout(url.toString(), {
            method: "PATCH",
            headers: getHeaders({ Prefer: "return=representation" }),
            body: JSON.stringify(values),
          });

          if (!res.ok) {
            const errText = await res.text();
            resolve({ data: null, error: { message: errText } });
            return;
          }

          const data = await res.json();
          resolve({ data, error: null });
        } catch (err: any) {
          resolve({
            data: null,
            error: { message: err?.name === "AbortError" ? "Supabase update timed out." : err.message },
          });
        }
      },
    };

    return executor;
  }

  delete() {
    const table = this.table;
    const filters = [...this.filters];

    const executor = {
      eq(column: string, value: any) {
        filters.push({ column, operator: "eq", value });
        return executor;
      },
      neq(column: string, value: any) {
        filters.push({ column, operator: "neq", value });
        return executor;
      },
      in(column: string, values: any[]) {
        filters.push({ column, operator: "in", value: `(${values.join(",")})` });
        return executor;
      },
      ilike(column: string, pattern: string) {
        filters.push({ column, operator: "ilike", value: pattern });
        return executor;
      },
      async then(resolve: (value: { data: any; error: any }) => void) {
        try {
          const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
          for (const f of filters) {
            url.searchParams.append(f.column, `${f.operator}.${f.value}`);
          }

          const res = await fetchWithTimeout(url.toString(), {
            method: "DELETE",
            headers: getHeaders(),
          });

          if (!res.ok) {
            const errText = await res.text();
            resolve({ data: null, error: { message: errText } });
            return;
          }

          resolve({ data: true, error: null });
        } catch (err: any) {
          resolve({
            data: null,
            error: { message: err?.name === "AbortError" ? "Supabase delete timed out." : err.message },
          });
        }
      },
    };

    return executor;
  }
}

export const supabase = {
  from: (table: string) => new SupabaseQueryBuilder(table),
  channel: (channelName: string) => ({
    on: (_type: string, _filter: any, _callback: (payload: any) => void) => ({
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
  removeChannel: (_channel: any) => {},
};
