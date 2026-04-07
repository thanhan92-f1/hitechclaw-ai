/**
 * Dataset Manager — Parse, profile, split, and transform datasets.
 */
import type {
  Dataset,
  DatasetProfile,
  ColumnSchema,
  DataType,
  NumericStats,
  DataSplit,
  FeaturePipeline,
  FeatureTransform,
} from './types.js';

/**
 * Parse CSV text into a Dataset.
 */
export function parseCSV(csv: string, options?: { delimiter?: string; name?: string }): Dataset {
  const delimiter = options?.delimiter ?? ',';
  const lines = csv.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have at least a header and one data row');

  const columns = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: unknown[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length === columns.length) {
      rows.push(values.map(inferValue));
    }
  }

  return {
    id: crypto.randomUUID(),
    name: options?.name ?? 'Untitled Dataset',
    source: 'csv',
    columns,
    rows,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Infer the JS value from a CSV string cell.
 */
function inferValue(val: string): unknown {
  if (val === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'na' || val.toLowerCase() === 'nan') return null;
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;
  const num = Number(val);
  if (!isNaN(num) && val.trim() !== '') return num;
  return val.replace(/^"|"$/g, '');
}

/**
 * Parse JSON array into a Dataset.
 */
export function parseJSON(json: string, options?: { name?: string }): Dataset {
  const data: Record<string, unknown>[] = JSON.parse(json);
  if (!Array.isArray(data) || data.length === 0) throw new Error('JSON must be a non-empty array of objects');

  const columns = Object.keys(data[0]);
  const rows = data.map((row) => columns.map((col) => row[col] ?? null));

  return {
    id: crypto.randomUUID(),
    name: options?.name ?? 'Untitled Dataset',
    source: 'json',
    columns,
    rows,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Profile a dataset — compute stats for each column.
 */
export function profileDataset(dataset: Dataset): DatasetProfile {
  const columnSchemas: ColumnSchema[] = dataset.columns.map((colName, colIdx) => {
    const values = dataset.rows.map((row) => row[colIdx]);
    const nonNull = values.filter((v) => v !== null && v !== undefined);
    const missing = values.length - nonNull.length;
    const uniqueSet = new Set(nonNull.map(String));

    const dataType = inferColumnType(nonNull);

    const schema: ColumnSchema = {
      name: colName,
      dataType,
      nullable: missing > 0,
      unique: uniqueSet.size,
      missing,
    };

    if (dataType === 'numeric') {
      const nums = nonNull.filter((v) => typeof v === 'number') as number[];
      if (nums.length > 0) {
        schema.stats = computeNumericStats(nums);
      }
    }

    if (dataType === 'categorical' || dataType === 'text') {
      const freq = new Map<string, number>();
      for (const v of nonNull) {
        const key = String(v);
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }
      schema.topValues = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));
    }

    return schema;
  });

  // Detect duplicate rows
  const rowStrings = new Set<string>();
  let duplicateRows = 0;
  for (const row of dataset.rows) {
    const key = JSON.stringify(row);
    if (rowStrings.has(key)) duplicateRows++;
    else rowStrings.add(key);
  }

  return {
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    columns: columnSchemas,
    memoryUsageMB: estimateMemory(dataset),
    duplicateRows,
  };
}

function inferColumnType(values: unknown[]): DataType {
  if (values.length === 0) return 'text';

  let numericCount = 0;
  let booleanCount = 0;
  let dateCount = 0;

  for (const v of values) {
    if (typeof v === 'number') numericCount++;
    else if (typeof v === 'boolean') booleanCount++;
    else if (typeof v === 'string' && !isNaN(Date.parse(v)) && v.length > 6) dateCount++;
  }

  const total = values.length;
  if (numericCount / total > 0.8) return 'numeric';
  if (booleanCount / total > 0.8) return 'boolean';
  if (dateCount / total > 0.8) return 'datetime';

  const uniqueRatio = new Set(values.map(String)).size / total;
  if (uniqueRatio > 0.9 && total > 20) return 'id';
  if (uniqueRatio < 0.5 || total <= 20) return 'categorical';
  return 'text';
}

function computeNumericStats(nums: number[]): NumericStats {
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const std = Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  const q25 = sorted[Math.floor(n * 0.25)];
  const q75 = sorted[Math.floor(n * 0.75)];

  return { min: sorted[0], max: sorted[n - 1], mean, median, std, q25, q75 };
}

function estimateMemory(dataset: Dataset): number {
  // Rough estimate: 8 bytes per number, avg 20 bytes per string
  let bytes = 0;
  for (const row of dataset.rows) {
    for (const val of row) {
      if (typeof val === 'number') bytes += 8;
      else if (typeof val === 'string') bytes += val.length * 2;
      else bytes += 4;
    }
  }
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

/**
 * Split dataset into train/test (and optional validation).
 */
export function splitDataset(
  dataset: Dataset,
  ratios: [number, number] | [number, number, number] = [0.8, 0.2],
  options?: { shuffle?: boolean; seed?: number; stratifyColumn?: string },
): DataSplit {
  const n = dataset.rows.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  if (options?.shuffle !== false) {
    // Fisher-Yates shuffle with optional seed
    let seed = options?.seed ?? Date.now();
    for (let i = n - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(seed) % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
  }

  const trainEnd = Math.floor(n * ratios[0]);
  const testEnd = ratios.length === 3 ? Math.floor(n * (ratios[0] + ratios[1])) : n;

  const trainIndices = indices.slice(0, trainEnd);
  const testIndices = indices.slice(trainEnd, testEnd);
  const valIndices = ratios.length === 3 ? indices.slice(testEnd) : undefined;

  return {
    train: { rows: trainIndices.map((i) => dataset.rows[i]), indices: trainIndices },
    test: { rows: testIndices.map((i) => dataset.rows[i]), indices: testIndices },
    validation: valIndices ? { rows: valIndices.map((i) => dataset.rows[i]), indices: valIndices } : undefined,
    ratios,
  };
}

/**
 * Apply a feature pipeline to transform data columns.
 */
export function applyFeaturePipeline(
  dataset: Dataset,
  pipeline: FeaturePipeline,
): { transformedRows: unknown[][]; newColumns: string[] } {
  let currentColumns = [...dataset.columns];
  let currentRows = dataset.rows.map((r) => [...r]);

  for (const step of pipeline.transforms) {
    const colIdx = currentColumns.indexOf(step.column);
    if (colIdx === -1) continue;

    const result = applyTransform(currentRows, currentColumns, colIdx, step.transform);
    currentRows = result.rows;
    currentColumns = result.columns;
  }

  return { transformedRows: currentRows, newColumns: currentColumns };
}

function applyTransform(
  rows: unknown[][],
  columns: string[],
  colIdx: number,
  transform: FeatureTransform,
): { rows: unknown[][]; columns: string[] } {
  const newColumns = [...columns];
  let newRows = rows.map((r) => [...r]);

  switch (transform.type) {
    case 'normalize': {
      const nums = newRows.map((r) => r[colIdx] as number).filter((v) => typeof v === 'number');
      if (transform.method === 'min-max') {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const range = max - min || 1;
        newRows = newRows.map((r) => {
          const v = r[colIdx];
          if (typeof v === 'number') r[colIdx] = (v - min) / range;
          return r;
        });
      } else if (transform.method === 'z-score') {
        const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
        const std = Math.sqrt(nums.reduce((s, v) => s + (v - mean) ** 2, 0) / nums.length) || 1;
        newRows = newRows.map((r) => {
          const v = r[colIdx];
          if (typeof v === 'number') r[colIdx] = (v - mean) / std;
          return r;
        });
      }
      break;
    }

    case 'encode': {
      if (transform.method === 'label') {
        const uniqueValues = [...new Set(newRows.map((r) => String(r[colIdx])))];
        const labelMap = new Map(uniqueValues.map((v, i) => [v, i]));
        newRows = newRows.map((r) => {
          r[colIdx] = labelMap.get(String(r[colIdx])) ?? -1;
          return r;
        });
      } else if (transform.method === 'one-hot') {
        const uniqueValues = [...new Set(newRows.map((r) => String(r[colIdx])))].sort();
        const colName = columns[colIdx];
        // Remove original column, add N new binary columns
        newColumns.splice(colIdx, 1, ...uniqueValues.map((v) => `${colName}_${v}`));
        newRows = newRows.map((r) => {
          const val = String(r[colIdx]);
          const encoded = uniqueValues.map((v) => (v === val ? 1 : 0));
          r.splice(colIdx, 1, ...encoded);
          return r;
        });
      }
      break;
    }

    case 'impute': {
      const nonNull = newRows.map((r) => r[colIdx]).filter((v) => v !== null && v !== undefined);
      let fillValue: unknown;
      if (transform.method === 'mean') {
        const nums = nonNull.filter((v) => typeof v === 'number') as number[];
        fillValue = nums.reduce((s, v) => s + v, 0) / nums.length;
      } else if (transform.method === 'median') {
        const nums = (nonNull.filter((v) => typeof v === 'number') as number[]).sort((a, b) => a - b);
        fillValue = nums[Math.floor(nums.length / 2)];
      } else if (transform.method === 'mode') {
        const freq = new Map<string, number>();
        for (const v of nonNull) {
          const key = String(v);
          freq.set(key, (freq.get(key) ?? 0) + 1);
        }
        fillValue = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      } else {
        fillValue = transform.value;
      }
      newRows = newRows.map((r) => {
        if (r[colIdx] === null || r[colIdx] === undefined) r[colIdx] = fillValue;
        return r;
      });
      break;
    }

    case 'log': {
      newRows = newRows.map((r) => {
        const v = r[colIdx];
        if (typeof v === 'number' && v > 0) r[colIdx] = Math.log(v);
        return r;
      });
      break;
    }

    case 'drop': {
      newColumns.splice(colIdx, 1);
      newRows = newRows.map((r) => {
        r.splice(colIdx, 1);
        return r;
      });
      break;
    }

    default:
      break;
  }

  return { rows: newRows, columns: newColumns };
}
