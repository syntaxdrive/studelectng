/**
 * StudElect Native Supabase Client
 * Direct REST interface with AbortController timeout on every request.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
    console.warn(
      "[SECURITY CONFIG] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from environment variables."
    );
  }
}

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

interface SelectOptions {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const MEMORY_CACHE = new Map<string, CacheEntry<any>>();

/**
 * In-memory TTL cache to reduce Supabase REST hits and egress on free-tier
 */
export async function fetchWithCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = MEMORY_CACHE.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }
  const data = await fetcher();
  MEMORY_CACHE.set(key, { data, expiresAt: now + ttlSeconds * 1000 });
  return data;
}

export function invalidateCache(keyPrefix?: string) {
  if (!keyPrefix) {
    MEMORY_CACHE.clear();
    return;
  }
  for (const k of MEMORY_CACHE.keys()) {
    if (k.startsWith(keyPrefix)) {
      MEMORY_CACHE.delete(k);
    }
  }
}

export class SupabaseQueryBuilder {
  private table: string;
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private selectedColumns: string = "*";
  private countOption?: "exact" | "planned" | "estimated";
  private isHeadOnly: boolean = false;
  private isSingleResult: boolean = false;
  private sortColumn?: string;
  private sortAsc: boolean = true;
  private limitCount?: number;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*", options?: SelectOptions) {
    this.selectedColumns = columns;
    if (options?.count) {
      this.countOption = options.count;
    }
    if (options?.head) {
      this.isHeadOnly = true;
    }
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

  lt(column: string, value: any) {
    this.filters.push({ column, operator: "lt", value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ column, operator: "gt", value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: "gte", value });
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

  async then(resolve: (value: { data: any; count?: number | null; error: any }) => void) {
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

      const preferDirectives: string[] = [];
      if (this.isSingleResult) preferDirectives.push("return=representation");
      if (this.countOption) preferDirectives.push(`count=${this.countOption}`);

      const headers = getHeaders(
        preferDirectives.length > 0 ? { Prefer: preferDirectives.join(",") } : undefined
      );

      const method = this.isHeadOnly ? "HEAD" : "GET";
      const res = await fetchWithTimeout(url.toString(), {
        method,
        headers,
        cache: "no-store",
      });

      let count: number | null = null;
      const contentRange = res.headers.get("content-range");
      if (contentRange) {
        const parts = contentRange.split("/");
        if (parts[1] && parts[1] !== "*") {
          count = parseInt(parts[1], 10) || 0;
        }
      }

      if (!res.ok) {
        const errorText = this.isHeadOnly ? `HTTP ${res.status}` : await res.text();
        resolve({ data: null, count, error: { message: errorText, status: res.status } });
        return;
      }

      if (this.isHeadOnly) {
        resolve({ data: null, count, error: null });
        return;
      }

      const json = await res.json();
      const result =
        this.isSingleResult && Array.isArray(json) ? json[0] ?? null : json;
      resolve({ data: result, count, error: null });
    } catch (err: any) {
      const isTimeout = err?.name === "AbortError";
      resolve({
        data: null,
        count: null,
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
      lt(column: string, value: any) {
        filters.push({ column, operator: "lt", value });
        return executor;
      },
      lte(column: string, value: any) {
        filters.push({ column, operator: "lte", value });
        return executor;
      },
      gt(column: string, value: any) {
        filters.push({ column, operator: "gt", value });
        return executor;
      },
      gte(column: string, value: any) {
        filters.push({ column, operator: "gte", value });
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
