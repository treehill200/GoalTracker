import { describe, expect, it } from "vitest";
import { mapHealthRecords, parseAppleHealthXml } from "@/lib/integrations/apple-health";
import {
  mapBankCsv,
  mapGenericCsv,
  normalizeDate,
  parseAmount,
  parseCsv,
} from "@/lib/integrations/csv";
import { mapStravaActivities } from "@/lib/integrations/strava";

const XML = `<?xml version="1.0"?>
<HealthData>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="kg" startDate="2026-03-01 07:00:00 -0800" endDate="2026-03-01 07:00:00 -0800" value="70"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" startDate="2026-03-01 20:00:00 -0800" value="70.4"/>
 <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-03-01 09:00:00 -0800" value="4000"/>
 <Record type="HKQuantityTypeIdentifierStepCount" unit="count" startDate="2026-03-01 18:00:00 -0800" value="2500"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" startDate="2026-03-01 18:00:00 -0800" value="70"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30.5" durationUnit="min" startDate="2026-03-02 06:30:00 -0800" endDate="2026-03-02 07:00:00 -0800">
 </Workout>
</HealthData>`;

describe("Apple Health export", () => {
  const records = parseAppleHealthXml(XML);
  it("parses body mass, steps and workouts and ignores other types", () => {
    expect(records.filter((r) => r.kind === "body_mass")).toHaveLength(2);
    expect(records.filter((r) => r.kind === "steps")).toHaveLength(2);
    expect(records.find((r) => r.kind === "workout")).toMatchObject({
      date: "2026-03-02",
      value: 30.5,
      label: "Running",
    });
    expect(records).toHaveLength(5);
  });
  it("maps to daily entries with unit conversion", () => {
    const e = mapHealthRecords(records, {
      bodyMassMetricId: "w",
      bodyMassUnit: "lb",
      stepsMetricId: "s",
      workoutMetricId: "g",
      workoutMode: "count",
    });
    expect(e.find((x) => x.metricId === "w")).toMatchObject({ date: "2026-03-01", value: 155.2 });
    expect(e.find((x) => x.metricId === "s")).toMatchObject({ value: 6500 });
    expect(e.find((x) => x.metricId === "g")).toMatchObject({ value: 1, date: "2026-03-02" });
  });
});

describe("CSV import", () => {
  it("normalizes dates and amounts", () => {
    expect(normalizeDate("3/7/2026")).toBe("2026-03-07");
    expect(normalizeDate("07.03.2026")).toBe("2026-03-07");
    expect(normalizeDate("2026-03-07T10:00:00Z")).toBe("2026-03-07");
    expect(normalizeDate("yesterday")).toBeNull();
    expect(parseAmount("$1,234.50")).toBe(1234.5);
    expect(parseAmount("(45.00)")).toBe(-45);
    expect(parseAmount("abc")).toBeNull();
  });
  it("maps generic rows", () => {
    const { headers, rows } = parseCsv("Day,Pages\n2026-03-01,20\n2026-03-02,x\n2026-03-03,15");
    expect(headers).toEqual(["Day", "Pages"]);
    expect(
      mapGenericCsv(rows, { dateColumn: "Day", valueColumn: "Pages", metricId: "p" }).map(
        (e) => e.value,
      ),
    ).toEqual([20, 15]);
  });
  it("maps bank transactions to daily savings totals", () => {
    const { rows } = parseCsv(
      "Date,Amount,Category\n03/01/2026,500.00,Savings transfer\n03/01/2026,-20,Groceries\n03/01/2026,100,Savings\n03/05/2026,(50),Savings",
    );
    expect(
      mapBankCsv(rows, {
        dateColumn: "Date",
        amountColumn: "Amount",
        categoryColumn: "Category",
        categoryFilter: "savings",
        mode: "deposits",
        metricId: "s",
      }),
    ).toEqual([
      { metricId: "s", value: 600, date: "2026-03-01", source: "bank", note: "Bank CSV" },
    ]);
    const net = mapBankCsv(rows, {
      dateColumn: "Date",
      amountColumn: "Amount",
      categoryColumn: null,
      categoryFilter: null,
      mode: "net",
      metricId: "s",
    });
    expect(net.map((e) => e.value)).toEqual([580, -50]);
  });
});

describe("Strava mapping", () => {
  const acts = [
    {
      id: 1,
      name: "Morning run",
      type: "Run",
      start_date_local: "2026-03-01T07:00:00Z",
      distance: 5000,
      moving_time: 1800,
    },
    {
      id: 2,
      name: "Ride",
      type: "Ride",
      start_date_local: "2026-03-02T07:00:00Z",
      distance: 20000,
      moving_time: 3600,
    },
  ];
  it("converts distance/time and filters types and duplicates", () => {
    const e = mapStravaActivities(
      acts,
      { distanceMetricId: "d", timeMetricId: "t", types: ["Run"], importedIds: [] },
      { distance: "km", time: "min" },
    );
    expect(e).toEqual([
      expect.objectContaining({ metricId: "d", value: 5, date: "2026-03-01" }),
      expect.objectContaining({ metricId: "t", value: 30 }),
    ]);
    expect(
      mapStravaActivities(
        acts,
        { distanceMetricId: "d", timeMetricId: null, types: [], importedIds: [1] },
        { distance: "miles", time: "min" },
      )[0].value,
    ).toBeCloseTo(12.43, 2);
  });
});
