import Papa from "papaparse";
import type { CsvParseResult, CsvSummaryRow, Trade, TradeSide } from "@/types/trade";

const TRADE_HEADER = "Trade Date";

export function parseTradingCsv(csvText: string): CsvParseResult {
  const warnings: string[] = [];
  const normalizedText = csvText.replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(normalizedText, {
    skipEmptyLines: "greedy"
  });

  if (parsed.errors.length > 0) {
    warnings.push(
      ...parsed.errors.map((error) => `Ligne ${error.row ?? "?"}: ${error.message}`)
    );
  }

  const rows = parsed.data.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  const tradeHeaderIndex = rows.findIndex((row) => normalizeCell(row[0]) === TRADE_HEADER);

  if (tradeHeaderIndex === -1) {
    return {
      trades: [],
      summaryRows: [],
      warnings: ["En-tête de trades introuvable. Le parseur attend une colonne Trade Date."]
    };
  }

  const summaryRows = parseSummaryRows(rows.slice(0, tradeHeaderIndex));
  const header = rows[tradeHeaderIndex].map(normalizeCell);
  const trades: Trade[] = [];

  rows.slice(tradeHeaderIndex + 1).forEach((row, rowIndex) => {
    const lineNumber = tradeHeaderIndex + rowIndex + 2;
    const record = recordFromRow(header, row);

    if (!isTradeRecord(record)) {
      warnings.push(`Ligne ${lineNumber} ignoree: date de trade invalide.`);
      return;
    }

    const entryTimestamp = parseDateTime(record["Entry Time"]);
    const exitTimestamp = parseDateTime(record["Exit Time"]);

    if (entryTimestamp === null || exitTimestamp === null) {
      warnings.push(`Ligne ${lineNumber} ignoree: heure d'entree ou de sortie invalide.`);
      return;
    }

    const entryDate = new Date(entryTimestamp);
    const tradeDate = formatTradeDate(record["Trade Date"], entryDate);
    const trade: Trade = {
      id: `${record["Entry Order Number"]}-${record["Exit Order Number"]}-${lineNumber}`,
      tradeDateRaw: record["Trade Date"],
      tradeDate,
      entryOrderNumber: record["Entry Order Number"],
      entrySide: parseSide(record["Entry Buy/Sell"]),
      entryTime: record["Entry Time"],
      entryTimestamp,
      entryHour: entryDate.getHours(),
      entryPrice: parseNumber(record["Entry Price"]),
      exitOrderNumber: record["Exit Order Number"],
      exitSide: parseSide(record["Exit Buy/Sell"]),
      exitTime: record["Exit Time"],
      exitTimestamp,
      exitPrice: parseNumber(record["Exit Price"]),
      lifeSpanSeconds: parseNumber(record["Trade Life Span (Seconds)"]),
      fillSize: parseNumber(record["Fill Size"]),
      tradePnl: parseNumber(record["Trade P&L"]),
      commissionFees: parseNumber(record["Commission & Fees"]),
      netPnl: parseNumber(record["Net P&L"]),
      ticksMade: record["Ticks Made"] ? parseNumber(record["Ticks Made"]) : null
    };

    trades.push(trade);
  });

  return { trades, summaryRows, warnings };
}

function parseSummaryRows(rows: string[][]): CsvSummaryRow[] {
  if (rows.length < 2) {
    return [];
  }

  const summaryHeader = rows[0].map(normalizeCell);

  return rows.slice(1).map((row) => {
    const values: Record<string, string> = {};
    summaryHeader.forEach((header, index) => {
      values[header] = normalizeCell(row[index]);
    });

    return {
      label: normalizeCell(row[0]),
      values
    };
  });
}

function recordFromRow(header: string[], row: string[]) {
  return header.reduce<Record<string, string>>((record, column, index) => {
    record[column] = normalizeCell(row[index]);
    return record;
  }, {});
}

function isTradeRecord(record: Record<string, string>) {
  return /^\d{8}$/.test(record["Trade Date"] ?? "");
}

function normalizeCell(value: unknown) {
  return String(value ?? "").trim();
}

function parseNumber(value: string) {
  const normalized = value
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!normalized) {
    return 0;
  }

  if (/^\(.+\)$/.test(normalized)) {
    return -Number(normalized.slice(1, -1));
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSide(value: string): TradeSide {
  return value === "S" ? "S" : "B";
}

function parseDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  ).getTime();
}

function formatTradeDate(rawDate: string, fallbackDate: Date) {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(rawDate);

  if (!match) {
    return fallbackDate.toISOString().slice(0, 10);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}
