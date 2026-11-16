"use client";

import { useEffect, useState } from "react";

/**
 * Today's weather, from Open-Meteo (free, no account). It is asked for by city, a fixed point in the middle of
 * Bristol, never by where the phone actually is, and nothing else about the app or its owner is sent.
 */

const PLACE = { latitude: "51.45", longitude: "-2.59" };
const CACHE_KEY = "locked-in:weather:v1";
/** Asked again after this long, so a forecast that changed during the day is picked up. */
const FRESH_MS = 3 * 3600_000;

export type Weather = { date: string; high: number; low: number; code: number; rain: number; at: number };

/** The World Meteorological Organization's weather codes, as one or two words. */
const WORDS: [number, string][] = [
  [0, "Clear"],
  [1, "Mostly clear"],
  [2, "Partly cloudy"],
  [3, "Cloudy"],
  [48, "Fog"],
  [57, "Drizzle"],
  [67, "Rain"],
  [77, "Snow"],
  [82, "Showers"],
  [86, "Snow showers"],
  [99, "Thunder"],
];
export const weatherWord = (code: number) => WORDS.find(([upTo]) => code <= upTo)?.[1] ?? "";

function cached(date: string): Weather | null {
  try {
    const w = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as Weather | null;
    return w && w.date === date ? w : null;
  } catch {
    return null;
  }
}

async function load(date: string): Promise<Weather | null> {
  const q = new URLSearchParams({ ...PLACE, daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max", timezone: "Europe/London", forecast_days: "1" });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!res.ok) return null;
  const d = ((await res.json()) as { daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[] } }).daily;
  if (!d?.time?.length || d.time[0] !== date || typeof d.temperature_2m_max?.[0] !== "number" || typeof d.temperature_2m_min?.[0] !== "number") return null;
  return { date, high: Math.round(d.temperature_2m_max[0]), low: Math.round(d.temperature_2m_min[0]), code: d.weather_code?.[0] ?? -1, rain: Math.round(d.precipitation_probability_max?.[0] ?? 0), at: Date.now() };
}

/** The forecast for `date` (today), kept on the device for the day so it shows at once and offline. */
export function useWeather(date: string): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!date) return;
    let gone = false;
    const id = window.setTimeout(() => {
      const have = cached(date);
      if (have) setWeather(have);
      if (have && Date.now() - have.at < FRESH_MS) return;
      load(date)
        .then((w) => {
          if (!w) return;
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(w));
          } catch {
            /* shown anyway */
          }
          if (!gone) setWeather(w);
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      gone = true;
      window.clearTimeout(id);
    };
  }, [date]);
  return weather && weather.date === date ? weather : null;
}
