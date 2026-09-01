"use client";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

function endOfWeek(date: Date) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

function computeRange(preset: string): { start: string; end: string } | null {
  const today = new Date();

  switch (preset) {
    case "hoje":
      return { start: toIso(today), end: toIso(today) };
    case "ontem": {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return { start: toIso(yesterday), end: toIso(yesterday) };
    }
    case "semana_atual":
      return { start: toIso(startOfWeek(today)), end: toIso(endOfWeek(today)) };
    case "semana_passada": {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      return { start: toIso(startOfWeek(lastWeek)), end: toIso(endOfWeek(lastWeek)) };
    }
    case "mes_atual":
      return {
        start: toIso(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: toIso(new Date(today.getFullYear(), today.getMonth() + 1, 0))
      };
    case "mes_passado":
      return {
        start: toIso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        end: toIso(new Date(today.getFullYear(), today.getMonth(), 0))
      };
    case "ano_atual":
      return {
        start: toIso(new Date(today.getFullYear(), 0, 1)),
        end: toIso(new Date(today.getFullYear(), 11, 31))
      };
    default:
      return null;
  }
}

export function PeriodPresetSelect() {
  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const range = computeRange(event.target.value);
    if (!range) return;

    const form = event.target.form;
    if (!form) return;

    const startInput = form.elements.namedItem("startDate") as HTMLInputElement | null;
    const endInput = form.elements.namedItem("endDate") as HTMLInputElement | null;
    if (startInput) startInput.value = range.start;
    if (endInput) endInput.value = range.end;

    form.requestSubmit();
  }

  return (
    <label>
      Período
      <select defaultValue="" onChange={handleChange}>
        <option value="">Personalizado</option>
        <option value="hoje">Hoje</option>
        <option value="ontem">Ontem</option>
        <option value="semana_atual">Esta semana</option>
        <option value="semana_passada">Semana passada</option>
        <option value="mes_atual">Este mês</option>
        <option value="mes_passado">Mês passado</option>
        <option value="ano_atual">Este ano</option>
      </select>
    </label>
  );
}
