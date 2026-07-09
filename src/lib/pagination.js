export const DEFAULT_PAGE_SIZE = 1000;

export async function collectPaginatedRows(fetchPage, pageSize = DEFAULT_PAGE_SIZE) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { data: null, error };

    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
